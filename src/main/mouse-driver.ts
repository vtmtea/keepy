import type { ActivityMode } from '../shared/types'

export interface MousePosition {
  x: number
  y: number
}

export interface MouseDriver {
  getPosition(): Promise<MousePosition>
  moveTo(position: MousePosition): Promise<void>
  click(): Promise<void>
}

export interface ScreenBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface ActivityActionDependencies {
  mouse: MouseDriver
  getScreenBoundsAt: (position: MousePosition) => ScreenBounds | Promise<ScreenBounds>
  restoreDelayMs?: number
  sleep?: (delayMs: number) => Promise<void>
}

export async function performActivityAction(
  mode: ActivityMode,
  dependencies: ActivityActionDependencies
): Promise<void> {
  if (mode === 'click') {
    await dependencies.mouse.click()
    return
  }

  const original = await dependencies.mouse.getPosition()
  const bounds = await dependencies.getScreenBoundsAt(original)
  const target = chooseNudgePosition(original, bounds)
  const beforeMove = await dependencies.mouse.getPosition()

  if (!samePosition(beforeMove, original) || samePosition(target, original)) {
    return
  }

  await dependencies.mouse.moveTo(target)

  const delayMs = dependencies.restoreDelayMs ?? 80
  const sleep = dependencies.sleep ?? defaultSleep
  await sleep(delayMs)

  const current = await dependencies.mouse.getPosition()
  if (samePosition(current, target)) {
    await dependencies.mouse.moveTo(original)
  }
}

export function chooseNudgePosition(position: MousePosition, bounds: ScreenBounds): MousePosition {
  const step = 2
  const right = bounds.x + Math.max(bounds.width - 1, 0)
  const bottom = bounds.y + Math.max(bounds.height - 1, 0)
  const canMoveRight = position.x + step <= right
  const canMoveLeft = position.x - step >= bounds.x
  const canMoveDown = position.y + step <= bottom
  const canMoveUp = position.y - step >= bounds.y

  if (canMoveRight) {
    return { x: position.x + step, y: position.y }
  }
  if (canMoveLeft) {
    return { x: position.x - step, y: position.y }
  }
  if (canMoveDown) {
    return { x: position.x, y: position.y + step }
  }
  if (canMoveUp) {
    return { x: position.x, y: position.y - step }
  }
  return { ...position }
}

export function samePosition(first: MousePosition, second: MousePosition): boolean {
  return first.x === second.x && first.y === second.y
}

function defaultSleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs))
}
