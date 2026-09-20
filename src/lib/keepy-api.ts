import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import type { ActivitySettings, ActivitySettingsInput, ActivityStatus, CloseRequest } from '../shared/types'

export const keepyApi = {
  getSettings: () => invoke<ActivitySettings>('get_settings'),
  saveSettings: (input: ActivitySettingsInput) => invoke<ActivitySettings>('save_settings', { input }),
  getStatus: () => invoke<ActivityStatus>('get_status'),
  start: () => invoke<ActivityStatus>('start_activity'),
  pause: () => invoke<ActivityStatus>('pause_activity'),
  showWindow: () => invoke<void>('show_window'),
  quit: () => invoke<void>('quit_app'),
  resolveClose: (action: 'quit' | 'tray', remember: boolean) =>
    invoke<void>('resolve_close', { action, remember }),
  onStatus: (listener: (status: ActivityStatus) => void): Promise<UnlistenFn> =>
    listen<ActivityStatus>('activity-status', (event) => listener(event.payload)),
  onCloseRequest: (listener: (request: CloseRequest) => void): Promise<UnlistenFn> =>
    listen<CloseRequest>('window-close-request', (event) => listener(event.payload))
}
