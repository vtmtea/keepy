export const SETTINGS_VERSION = 1
export const MIN_INTERVAL_SECONDS = 10
export const MAX_INTERVAL_SECONDS = 3600

export type ActivityMode = 'move' | 'click'
export type ActivityPhase = 'paused' | 'running' | 'error'
export type CloseAction = 'quit' | 'tray'

export interface CloseRequest {
  defaultAction: CloseAction
  promptOnClose: boolean
}

export interface CloseResolution {
  action: CloseAction
  remember: boolean
}

export interface ActivitySettings {
  version: number
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
