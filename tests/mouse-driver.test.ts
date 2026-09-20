import { describe, expect, it, vi } from 'vitest'
import {
  chooseNudgePosition,
  performActivityAction,
  type MouseDriver,
  type MousePosition
} from '../src/main/mouse-driver'

describe('mouse activity action', () => {
  it('nudges right and restores when the user has not moved', async () => {
    let current: MousePosition = { x: 50, y: 50 }
    const moves: MousePosition[] = []
    const mouse: MouseDriver = {
      getPosition: vi.fn(async () => ({ ...current })),
      moveTo: vi.fn(async (position) => {
        current = { ...position }
        moves.push({ ...current })
      }),
      click: vi.fn(async () => undefined)
    }

    await performActivityAction('move', {
      mouse,
      getScreenBoundsAt: () => ({ x: 0, y: 0, width: 1920, height: 1080 }),
      restoreDelayMs: 0,
      sleep: async () => undefined
    })

    expect(moves).toEqual([{ x: 52, y: 50 }, { x: 50, y: 50 }])
  })

  it('does not restore over a user movement', async () => {
    let current: MousePosition = { x: 50, y: 50 }
    const moves: MousePosition[] = []
    const mouse: MouseDriver = {
      getPosition: vi.fn(async () => ({ ...current })),
      moveTo: vi.fn(async (position) => {
        current = { ...position }
        moves.push({ ...current })
      }),
      click: vi.fn(async () => undefined)
    }

    await performActivityAction('move', {
      mouse,
      getScreenBoundsAt: () => ({ x: 0, y: 0, width: 1920, height: 1080 }),
      sleep: async () => {
        current = { x: 700, y: 400 }
      }
    })

    expect(moves).toEqual([{ x: 52, y: 50 }])
    expect(current).toEqual({ x: 700, y: 400 })
  })

  it('skips the action if the user moves before the nudge starts', async () => {
    let current: MousePosition = { x: 50, y: 50 }
    const mouse: MouseDriver = {
      getPosition: vi.fn()
        .mockResolvedValueOnce({ x: 50, y: 50 })
        .mockImplementation(async () => ({ ...current })),
      moveTo: vi.fn(async () => undefined),
      click: vi.fn(async () => undefined)
    }

    current = { x: 400, y: 300 }
    await performActivityAction('move', {
      mouse,
      getScreenBoundsAt: () => ({ x: 0, y: 0, width: 1920, height: 1080 })
    })

    expect(mouse.moveTo).not.toHaveBeenCalled()
  })

  it('clicks without moving in click mode', async () => {
    const click = vi.fn(async () => undefined)
    const mouse: MouseDriver = {
      getPosition: vi.fn(async () => ({ x: 0, y: 0 })),
      moveTo: vi.fn(async () => undefined),
      click
    }

    await performActivityAction('click', {
      mouse,
      getScreenBoundsAt: () => ({ x: 0, y: 0, width: 1920, height: 1080 })
    })

    expect(click).toHaveBeenCalledOnce()
    expect(mouse.moveTo).not.toHaveBeenCalled()
  })
})

describe('chooseNudgePosition', () => {
  it('chooses a safe direction at the right edge', () => {
    expect(chooseNudgePosition({ x: 1919, y: 500 }, { x: 0, y: 0, width: 1920, height: 1080 })).toEqual({
      x: 1917,
      y: 500
    })
  })
})
