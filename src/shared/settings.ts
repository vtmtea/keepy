import {
  MAX_INTERVAL_SECONDS,
  MIN_INTERVAL_SECONDS,
  SETTINGS_VERSION,
  type ActivityMode,
  type ActivitySettings,
  type ActivitySettingsInput
} from './types'

export const DEFAULT_SETTINGS: ActivitySettings = {
  version: SETTINGS_VERSION,
  intervalSeconds: 60,
  mode: 'move',
  clickAcknowledged: false
}

export class SettingsValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SettingsValidationError'
  }
}

export function validateSettingsInput(input: unknown): ActivitySettingsInput {
  if (!isRecord(input)) {
    throw new SettingsValidationError('设置格式无效。')
  }

  const { intervalSeconds, mode, clickAcknowledged } = input

  if (
    typeof intervalSeconds !== 'number' ||
    !Number.isInteger(intervalSeconds) ||
    intervalSeconds < MIN_INTERVAL_SECONDS ||
    intervalSeconds > MAX_INTERVAL_SECONDS
  ) {
    throw new SettingsValidationError(
      `间隔必须是 ${MIN_INTERVAL_SECONDS} 到 ${MAX_INTERVAL_SECONDS} 秒之间的整数。`
    )
  }

  if (mode !== 'move' && mode !== 'click') {
    throw new SettingsValidationError('活动方式无效。')
  }

  if (typeof clickAcknowledged !== 'boolean') {
    throw new SettingsValidationError('点击确认状态无效。')
  }

  return { intervalSeconds, mode, clickAcknowledged }
}

export function createSettings(input: unknown): ActivitySettings {
  return {
    version: SETTINGS_VERSION,
    ...validateSettingsInput(input)
  }
}

export function readStoredSettings(input: unknown): ActivitySettings {
  if (!isRecord(input) || input.version !== SETTINGS_VERSION) {
    return { ...DEFAULT_SETTINGS }
  }

  try {
    return createSettings(input)
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function isClickMode(mode: ActivityMode): boolean {
  return mode === 'click'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
