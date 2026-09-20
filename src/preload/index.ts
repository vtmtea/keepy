import { contextBridge, ipcRenderer } from 'electron'
import type {
  ActivitySettings,
  ActivitySettingsInput,
  ActivityStatus,
  KeepyApi
} from '../shared/types'

const api: KeepyApi = {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (input: ActivitySettingsInput) => ipcRenderer.invoke('settings:save', input),
  getStatus: () => ipcRenderer.invoke('activity:status'),
  start: () => ipcRenderer.invoke('activity:start'),
  pause: () => ipcRenderer.invoke('activity:pause'),
  showWindow: () => ipcRenderer.invoke('window:show'),
  quit: () => ipcRenderer.invoke('app:quit'),
  onStatus: (listener: (status: ActivityStatus) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: ActivityStatus) => listener(status)
    ipcRenderer.on('activity:status-changed', handler)
    return () => ipcRenderer.removeListener('activity:status-changed', handler)
  }
}

contextBridge.exposeInMainWorld('keepy', api)
