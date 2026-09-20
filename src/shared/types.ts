export const SETTINGS_VERSION = 1
export const MIN_INTERVAL_SECONDS = 10
export const MAX_INTERVAL_SECONDS = 3600

export type ActivityMode = 'move' | 'click'
export type ActivityPhase = 'paused' | 'running' | 'error'

export interface ActivitySettings {
  version: typeof SETTINGS_VERSION
  intervalSeconds: number
  mode: ActivityMode
  clickAcknowledged: boolean
}

export interface ActivitySettingsInput {
  intervalSeconds: number
  mode: ActivityMode
  clickAcknowledged: boolean
}

export interface ActivityStatus {
  phase: ActivityPhase
  intervalSeconds: number
  mode: ActivityMode
  lastActionAt: number | null
  nextActionAt: number | null
  errorMessage: string | null
}

export interface KeepyApi {
  getSettings: () => Promise<ActivitySettings>
  saveSettings: (input: ActivitySettingsInput) => Promise<ActivitySettings>
  getStatus: () => Promise<ActivityStatus>
  start: () => Promise<ActivityStatus>
  pause: () => Promise<ActivityStatus>
  showWindow: () => Promise<void>
  quit: () => Promise<void>
  onStatus: (listener: (status: ActivityStatus) => void) => () => void
}

declare global {
  interface Window {
    keepy: KeepyApi
  }
}
