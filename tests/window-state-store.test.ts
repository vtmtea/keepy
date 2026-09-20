import { describe, expect, it } from 'vitest'
import {
  DEFAULT_WINDOW_STATE,
  MIN_WINDOW_HEIGHT,
  MIN_WINDOW_WIDTH,
  WindowStateStore,
  readStoredWindowState
} from '../src/main/window-state-store'

function tempPath(): string {
  return `/tmp/keepy-window-state-${Date.now()}-${Math.random()}.json`
}

describe('window state', () => {
  it('falls back to defaults for invalid dimensions', () => {
    expect(readStoredWindowState({
      version: 1,
      width: MIN_WINDOW_WIDTH - 1,
      height: MIN_WINDOW_HEIGHT - 1,
      closeAction: 'invalid',
      promptOnClose: 'yes'
    })).toEqual(DEFAULT_WINDOW_STATE)
  })

  it('persists dimensions and close preferences', async () => {
    const store = new WindowStateStore(tempPath())
    const saved = await store.save({ width: 920, height: 700, closeAction: 'quit', promptOnClose: false })
    const reloaded = new WindowStateStore(store.path)

    expect(saved).toMatchObject({ width: 920, height: 700, closeAction: 'quit', promptOnClose: false })
    await expect(reloaded.load()).resolves.toMatchObject(saved)
  })
})
