import type { ActivitySettings, ActivitySettingsInput, ActivityStatus } from '../shared/types'
import { MAX_INTERVAL_SECONDS, MIN_INTERVAL_SECONDS } from '../shared/types'
import './styles.css'

const form = document.querySelector<HTMLFormElement>('#settings-form')!
const intervalInput = document.querySelector<HTMLInputElement>('#interval')!
const modeInputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[name="mode"]'))
const clickWarning = document.querySelector<HTMLElement>('#click-warning')!
const clickAcknowledged = document.querySelector<HTMLInputElement>('#click-acknowledged')!
const toggleButton = document.querySelector<HTMLButtonElement>('#toggle-button')!
const saveButton = document.querySelector<HTMLButtonElement>('#save-button')!
const statusTitle = document.querySelector<HTMLElement>('#status-title')!
const statusPill = document.querySelector<HTMLElement>('#status-pill')!
const statusDetail = document.querySelector<HTMLElement>('#status-detail')!
const lastAction = document.querySelector<HTMLElement>('#last-action')!
const nextAction = document.querySelector<HTMLElement>('#next-action')!
const errorBox = document.querySelector<HTMLElement>('#error-box')!
const formMessage = document.querySelector<HTMLElement>('#form-message')!
const saveState = document.querySelector<HTMLElement>('#save-state')!

let currentStatus: ActivityStatus | null = null

void initialize()

async function initialize(): Promise<void> {
  try {
    const [settings, status] = await Promise.all([window.keepy.getSettings(), window.keepy.getStatus()])
    renderSettings(settings)
    renderStatus(status)
    window.keepy.onStatus(renderStatus)
  } catch (error) {
    showFormMessage(errorMessage(error), true)
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault()
  void saveSettings()
})

toggleButton.addEventListener('click', () => {
  void toggleActivity()
})

for (const input of modeInputs) {
  input.addEventListener('change', () => {
    updateClickWarning()
    markSettingsDirty()
  })
}

intervalInput.addEventListener('input', markSettingsDirty)

clickAcknowledged.addEventListener('change', () => {
  markSettingsDirty()
  if (!clickAcknowledged.checked && selectedMode() === 'click') {
    showFormMessage('开始点击模式前需要保留此确认。', false)
  }
})

async function saveSettings(): Promise<ActivitySettings | null> {
  const settings = readSettingsForm()
  if (!settings) {
    return null
  }

  setBusy(true)
  try {
    const saved = await window.keepy.saveSettings(settings)
    renderSettings(saved)
    renderStatus(await window.keepy.getStatus())
    saveState.textContent = '已保存'
    saveState.classList.remove('is-dirty')
    showFormMessage('设置已保存。', false)
    return saved
  } catch (error) {
    showFormMessage(errorMessage(error), true)
    return null
  } finally {
    setBusy(false)
  }
}

async function toggleActivity(): Promise<void> {
  setBusy(true)
  try {
    if (currentStatus?.phase === 'running') {
      renderStatus(await window.keepy.pause())
      return
    }

    const saved = await saveSettings()
    if (!saved) {
      return
    }
    renderStatus(await window.keepy.start())
  } catch (error) {
    showFormMessage(errorMessage(error), true)
  } finally {
    setBusy(false)
  }
}

function readSettingsForm(): ActivitySettingsInput | null {
  const intervalSeconds = Number(intervalInput.value)
  if (
    !Number.isInteger(intervalSeconds) ||
    intervalSeconds < MIN_INTERVAL_SECONDS ||
    intervalSeconds > MAX_INTERVAL_SECONDS
  ) {
    showFormMessage(`间隔必须是 ${MIN_INTERVAL_SECONDS} 到 ${MAX_INTERVAL_SECONDS} 秒之间的整数。`, true)
    intervalInput.focus()
    return null
  }

  const mode = selectedMode()
  if (mode === 'click' && !clickAcknowledged.checked) {
    showFormMessage('请确认点击模式的影响后再启动。', true)
    clickAcknowledged.focus()
    return null
  }

  return { intervalSeconds, mode, clickAcknowledged: clickAcknowledged.checked }
}

function selectedMode(): 'move' | 'click' {
  return modeInputs.find((input) => input.checked)?.value === 'click' ? 'click' : 'move'
}

function renderSettings(settings: ActivitySettings): void {
  intervalInput.value = String(settings.intervalSeconds)
  for (const input of modeInputs) {
    input.checked = input.value === settings.mode
  }
  clickAcknowledged.checked = settings.clickAcknowledged
  saveState.textContent = '已保存'
  saveState.classList.remove('is-dirty')
  updateClickWarning()
}

function updateClickWarning(): void {
  const clickSelected = selectedMode() === 'click'
  clickWarning.hidden = !clickSelected
}

function renderStatus(status: ActivityStatus): void {
  currentStatus = status
  const isRunning = status.phase === 'running'
  const labels = {
    paused: ['已暂停', '暂停'],
    running: ['正在运行', '运行中'],
    error: ['需要处理', '错误']
  } as const
  const [title, pill] = labels[status.phase]

  statusTitle.textContent = title
  statusPill.textContent = pill
  statusPill.className = `status-pill ${status.phase}`
  toggleButton.textContent = isRunning ? '暂停 Keepy' : '开始 Keepy'
  toggleButton.classList.toggle('is-pausing', isRunning)
  lastAction.textContent = formatTime(status.lastActionAt, '尚未执行')
  nextAction.textContent = formatTime(status.nextActionAt, '未安排')
  statusDetail.textContent = status.phase === 'running'
    ? `每 ${status.intervalSeconds} 秒执行一次${status.mode === 'move' ? '轻微移动' : '点击'}动作。`
    : status.phase === 'error'
      ? '鼠标动作未能完成，Keepy 已暂停。'
      : '应用会继续驻留在系统托盘中。'

  errorBox.hidden = !status.errorMessage
  errorBox.textContent = status.errorMessage ?? ''
}

function formatTime(timestamp: number | null, fallback: string): string {
  if (!timestamp) {
    return fallback
  }
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(new Date(timestamp))
}

function markSettingsDirty(): void {
  saveState.textContent = '未保存'
  saveState.classList.add('is-dirty')
}

function setBusy(busy: boolean): void {
  toggleButton.disabled = busy
  saveButton.disabled = busy
}

function showFormMessage(message: string, isError: boolean): void {
  formMessage.textContent = message
  formMessage.classList.toggle('is-error', isError)
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '操作未能完成。'
}
