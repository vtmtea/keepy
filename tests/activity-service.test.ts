import { describe, expect, it, vi } from 'vitest'
import { ActivityService } from '../src/main/activity-service'
import type { MouseDriver } from '../src/main/mouse-driver'
import type { ActivitySettings } from '../src/shared/types'

const moveSettings: ActivitySettings = {
  version: 1,
  intervalSeconds: 10,
  mode: 'move',
  clickAcknowledged: false
}

const clickSettings: ActivitySettings = {
  ...moveSettings,
  mode: 'click',
  clickAcknowledged: true
}

describe('ActivityService', () => {
  it('schedules one action and keeps the next action queued', async () => {
    let callback: (() => void) | undefined
    const mouse: MouseDriver = {
      getPosition: vi.fn()
        .mockResolvedValueOnce({ x: 20, y: 20 })
        .mockResolvedValueOnce({ x: 20, y: 20 })
        .mockResolvedValueOnce({ x: 22, y: 20 }),
      moveTo: vi.fn(async () => undefined),
      click: vi.fn(async () => undefined)
    }
    const service = new ActivityService(
      {
        mouse,
        getScreenBoundsAt: () => ({ x: 0, y: 0, width: 100, height: 100 }),
        sleep: async () => undefined,
        now: () => 1000,
        setTimeout: vi.fn((next) => {
          callback = next
          return 1 as unknown as ReturnType<typeof setTimeout>
        }),
        clearTimeout: vi.fn()
      },
      moveSettings
    )

    expect(service.start().phase).toBe('running')
    expect(service.getStatus().nextActionAt).toBe(11000)
    callback?.()
    await vi.waitFor(() => {
      expect(mouse.moveTo).toHaveBeenCalledTimes(2)
    })

    expect(service.getStatus().lastActionAt).toBe(1000)
    expect(service.getStatus().phase).toBe('running')
  })

  it('does not requeue an action paused while it is still running', async () => {
    let callback: (() => void) | undefined
    let releaseClick: (() => void) | undefined
    const clickStarted = new Promise<void>((resolve) => {
      releaseClick = resolve
    })
    const setTimeout = vi.fn((next: () => void): ReturnType<typeof globalThis.setTimeout> => {
      callback = next
      return 1 as unknown as ReturnType<typeof setTimeout>
    })
    const mouse: MouseDriver = {
      getPosition: vi.fn(async () => ({ x: 0, y: 0 })),
      moveTo: vi.fn(async () => undefined),
      click: vi.fn(async () => clickStarted)
    }
    const service = new ActivityService(
      {
        mouse,
        getScreenBoundsAt: () => ({ x: 0, y: 0, width: 100, height: 100 }),
        setTimeout,
        clearTimeout: vi.fn()
      },
      clickSettings
    )

    service.start()
    callback?.()
    await vi.waitFor(() => expect(mouse.click).toHaveBeenCalledOnce())
    service.pause()
    releaseClick?.()
    await vi.waitFor(() => expect(service.getStatus().lastActionAt).not.toBeNull())

    expect(service.getStatus().phase).toBe('paused')
    expect(service.getStatus().nextActionAt).toBeNull()
    expect(setTimeout).toHaveBeenCalledOnce()
  })

  it('pauses when an unacknowledged click setting is applied', () => {
    const service = new ActivityService(
      {
        mouse: {
          getPosition: vi.fn(async () => ({ x: 0, y: 0 })),
          moveTo: vi.fn(async () => undefined),
          click: vi.fn(async () => undefined)
        },
        getScreenBoundsAt: () => ({ x: 0, y: 0, width: 100, height: 100 }),
        setTimeout: vi.fn(() => 1 as unknown as ReturnType<typeof setTimeout>),
        clearTimeout: vi.fn()
      },
      moveSettings
    )

    service.start()
    const status = service.updateSettings({ ...clickSettings, clickAcknowledged: false })
    expect(status.phase).toBe('paused')
    expect(status.nextActionAt).toBeNull()
  })
})
