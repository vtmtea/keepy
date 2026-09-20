import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS,
  SettingsValidationError,
  createSettings,
  readStoredSettings,
  validateSettingsInput
} from '../src/shared/settings'

describe('settings validation', () => {
  it('accepts a valid settings input', () => {
    expect(
      createSettings({ intervalSeconds: 90, mode: 'move', clickAcknowledged: false })
    ).toEqual({ version: 1, intervalSeconds: 90, mode: 'move', clickAcknowledged: false })
  })

  it('rejects an interval outside the supported range', () => {
    expect(() =>
      validateSettingsInput({ intervalSeconds: 9, mode: 'move', clickAcknowledged: false })
    ).toThrow(SettingsValidationError)
    expect(() =>
      validateSettingsInput({ intervalSeconds: 3601, mode: 'move', clickAcknowledged: false })
    ).toThrow(SettingsValidationError)
  })

  it('falls back to defaults for incompatible stored settings', () => {
    expect(readStoredSettings({ version: 999, intervalSeconds: 60, mode: 'move' })).toEqual(
      DEFAULT_SETTINGS
    )
  })
})
