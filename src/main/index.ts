import { app, BrowserWindow, Menu, nativeImage, Tray, ipcMain } from 'electron'
import { join } from 'node:path'
import { SettingsStore, settingsPath } from './settings-store'
import { WindowStateStore, windowStatePath, type WindowState } from './window-state-store'
import { ActivityService } from './activity-service'
import { WindowsMouseDriver } from './windows-mouse-driver'
import type { ScreenBounds } from './mouse-driver'
import { createSettings } from '../shared/settings'
import type { ActivitySettings, ActivitySettingsInput, ActivityStatus, CloseResolution } from '../shared/types'

const hasSingleInstance = app.requestSingleInstanceLock()

if (!hasSingleInstance) {
  app.quit()
} else {
  let mainWindow: BrowserWindow | null = null
  let tray: Tray | null = null
  let isQuitting = false
  let activityService: ActivityService | null = null
  let settingsStore: SettingsStore | null = null
  let currentSettings: ActivitySettings | null = null
  let windowStateStore: WindowStateStore | null = null
  let windowState: WindowState | null = null
  let closeApproved = false
  let windowStateSaveTimer: ReturnType<typeof setTimeout> | null = null

  app.on('second-instance', () => {
    showMainWindow()
  })

  const mouseDriver = new WindowsMouseDriver()

  app.whenReady().then(async () => {
    settingsStore = new SettingsStore(settingsPath(app.getPath('userData')))
    currentSettings = await settingsStore.load()
    windowStateStore = new WindowStateStore(windowStatePath(app.getPath('userData')))
    windowState = await windowStateStore.load()
    activityService = new ActivityService(
      {
        mouse: mouseDriver,
        getScreenBoundsAt: (position) => getScreenBoundsAt(position),
        onStatus: (status) => {
          broadcastStatus(status)
          updateTrayMenu(status)
        }
      },
      currentSettings
    )

    createMainWindow()
    createTray()
    registerIpcHandlers()
    updateTrayMenu(activityService.getStatus())

    if (process.env.ELECTRON_RENDERER_URL) {
      await mainWindow?.loadURL(process.env.ELECTRON_RENDERER_URL)
    } else {
      await mainWindow?.loadFile(join(__dirname, '../renderer/index.html'))
    }
    showMainWindow()
  })

  app.on('activate', () => {
    showMainWindow()
  })

  app.on('before-quit', () => {
    isQuitting = true
    activityService?.dispose()
    tray?.destroy()
  })

  async function getScreenBoundsAt(position: { x: number; y: number }): Promise<ScreenBounds> {
    return mouseDriver.getScreenBoundsAt(position)
  }

  function createMainWindow(): void {
    const savedState = windowState ?? {
      width: 780,
      height: 650,
      closeAction: 'tray' as const,
      promptOnClose: true
    }

    mainWindow = new BrowserWindow({
      width: savedState.width,
      height: savedState.height,
      minWidth: 620,
      minHeight: 560,
      show: false,
      autoHideMenuBar: true,
      backgroundColor: '#f4f7fb',
      webPreferences: {
        preload: join(__dirname, '../preload/index.mjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false
      }
    })

    mainWindow.on('resize', scheduleWindowStateSave)
    mainWindow.on('move', scheduleWindowStateSave)

    mainWindow.on('close', (event) => {
      saveWindowState()
      if (isQuitting || closeApproved) {
        return
      }

      event.preventDefault()
      requestCloseConfirmation()
    })

    mainWindow.on('closed', () => {
      mainWindow = null
    })
  }

  function requestCloseConfirmation(): void {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return
    }

    const state = windowStateStore?.get() ?? windowState
    if (!state || !state.promptOnClose) {
      applyCloseAction(state?.closeAction ?? 'tray')
      return
    }

    mainWindow.webContents.send('window:close-request', {
      defaultAction: state.closeAction,
      promptOnClose: state.promptOnClose
    })
  }

  function applyCloseAction(action: 'quit' | 'tray'): void {
    if (action === 'quit') {
      closeApproved = true
      isQuitting = true
      app.quit()
      return
    }
    mainWindow?.hide()
  }

  function scheduleWindowStateSave(): void {
    if (windowStateSaveTimer !== null) {
      clearTimeout(windowStateSaveTimer)
    }
    windowStateSaveTimer = setTimeout(() => {
      saveWindowState()
      windowStateSaveTimer = null
    }, 250)
  }

  function saveWindowState(): void {
    if (!mainWindow || mainWindow.isDestroyed() || !windowStateStore) {
      return
    }

    const [width, height] = mainWindow.getSize()
    windowState = windowStateStore.saveSync({ width, height })
  }

  function createTray(): void {
    tray = new Tray(createTrayIcon())
    tray.setToolTip('Keepy · 鼠标活动助手')
    tray.on('double-click', showMainWindow)
  }

  function registerIpcHandlers(): void {
    ipcMain.handle('settings:get', () => {
      ensureReady()
      return currentSettings
    })

    ipcMain.handle('settings:save', async (_event, input: ActivitySettingsInput) => {
      ensureReady()
      const validated = createSettings(input)
      currentSettings = await settingsStore!.save(validated)
      activityService!.updateSettings(currentSettings)
      return currentSettings
    })

    ipcMain.handle('activity:status', () => {
      ensureReady()
      return activityService!.getStatus()
    })

    ipcMain.handle('activity:start', () => {
      ensureReady()
      if (currentSettings!.mode === 'click' && !currentSettings!.clickAcknowledged) {
        throw new Error('请先确认点击模式可能影响当前活动窗口。')
      }
      return activityService!.start()
    })

    ipcMain.handle('activity:pause', () => {
      ensureReady()
      return activityService!.pause()
    })

    ipcMain.handle('window:show', () => {
      showMainWindow()
    })

    ipcMain.handle('window:resolve-close', (_event, resolution: CloseResolution) => {
      if (resolution.action !== 'quit' && resolution.action !== 'tray') {
        throw new Error('关闭操作无效。')
      }

      if (resolution.remember && windowStateStore) {
        windowState = windowStateStore.saveSync({
          closeAction: resolution.action,
          promptOnClose: false
        })
      }

      applyCloseAction(resolution.action)
    })

    ipcMain.handle('app:quit', () => {
      isQuitting = true
      closeApproved = true
      app.quit()
    })
  }

  function ensureReady(): void {
    if (!activityService || !settingsStore || !currentSettings) {
      throw new Error('应用尚未准备完成。')
    }
  }

  function showMainWindow(): void {
    if (!mainWindow) {
      return
    }
    if (mainWindow.isMinimized()) {
      mainWindow.restore()
    }
    mainWindow.show()
    mainWindow.focus()
  }

  function broadcastStatus(status: ActivityStatus): void {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return
    }
    mainWindow.webContents.send('activity:status-changed', status)
  }

  function updateTrayMenu(status: ActivityStatus): void {
    if (!tray) {
      return
    }

    const isRunning = status.phase === 'running'
    tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: isRunning ? '暂停 Keepy' : '开始 Keepy',
          click: () => {
            if (isRunning) {
              activityService?.pause()
            } else if (currentSettings?.mode === 'click' && !currentSettings.clickAcknowledged) {
              showMainWindow()
            } else {
              activityService?.start()
            }
          }
        },
        { type: 'separator' },
        { label: '打开控制面板', click: showMainWindow },
        { label: '退出 Keepy', click: () => {
          isQuitting = true
          app.quit()
        } }
      ])
    )
  }

  function createTrayIcon(): Electron.NativeImage {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
        <rect x="2" y="2" width="28" height="28" rx="9" fill="#2563eb"/>
        <circle cx="16" cy="16" r="7" fill="none" stroke="#fff" stroke-width="2.4"/>
        <circle cx="16" cy="16" r="2.2" fill="#fff"/>
      </svg>`
    return nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`)
  }
}
