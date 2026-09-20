import { app, BrowserWindow, Menu, nativeImage, Tray, ipcMain } from 'electron'
import { join } from 'node:path'
import { SettingsStore, settingsPath } from './settings-store'
import { ActivityService } from './activity-service'
import { WindowsMouseDriver } from './windows-mouse-driver'
import type { ScreenBounds } from './mouse-driver'
import { createSettings } from '../shared/settings'
import type { ActivitySettings, ActivitySettingsInput, ActivityStatus } from '../shared/types'

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

  app.on('second-instance', () => {
    showMainWindow()
  })

  const mouseDriver = new WindowsMouseDriver()

  app.whenReady().then(async () => {
    settingsStore = new SettingsStore(settingsPath(app.getPath('userData')))
    currentSettings = await settingsStore.load()
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
    mainWindow = new BrowserWindow({
      width: 780,
      height: 650,
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

    mainWindow.on('close', (event) => {
      if (!isQuitting) {
        event.preventDefault()
        mainWindow?.hide()
      }
    })

    mainWindow.on('closed', () => {
      mainWindow = null
    })
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

    ipcMain.handle('app:quit', () => {
      isQuitting = true
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
