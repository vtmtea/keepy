import { useEffect, useRef, useState } from 'react'
import { keepyApi } from './lib/keepy-api'
import {
  MAX_INTERVAL_SECONDS,
  MIN_INTERVAL_SECONDS,
  type ActivityMode,
  type ActivitySettings,
  type ActivityStatus,
  type CloseAction,
  type CloseRequest
} from './shared/types'

const DEFAULT_SETTINGS: ActivitySettings = {
  version: 1,
  intervalSeconds: 60,
  mode: 'move',
  clickAcknowledged: false
}

const DEFAULT_STATUS: ActivityStatus = {
  phase: 'paused',
  intervalSeconds: 60,
  mode: 'move',
  lastActionAt: null,
  nextActionAt: null,
  errorMessage: null
}

export default function App() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [status, setStatus] = useState(DEFAULT_STATUS)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [message, setMessage] = useState('')
  const [messageIsError, setMessageIsError] = useState(false)
  const [closeRequest, setCloseRequest] = useState<CloseRequest | null>(null)
  const [closeAction, setCloseAction] = useState<CloseAction>('tray')
  const [rememberClose, setRememberClose] = useState(false)
  const closeDialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    let active = true
    let unlistenStatus: (() => void) | undefined
    let unlistenClose: (() => void) | undefined

    void Promise.all([keepyApi.getSettings(), keepyApi.getStatus()])
      .then(async ([nextSettings, nextStatus]) => {
        if (!active) return
        setSettings(nextSettings)
        setStatus(nextStatus)
        setLoaded(true)
        unlistenStatus = await keepyApi.onStatus(setStatus)
        unlistenClose = await keepyApi.onCloseRequest((request) => {
          setCloseRequest(request)
          setCloseAction(request.defaultAction)
          setRememberClose(false)
        })
      })
      .catch((error: unknown) => showMessage(errorMessage(error), true))

    return () => {
      active = false
      unlistenStatus?.()
      unlistenClose?.()
    }
  }, [])

  useEffect(() => {
    const dialog = closeDialog.current
    if (!dialog || !closeRequest) return
    if (!dialog.open) dialog.showModal()
  }, [closeRequest])

  const selectedMode: ActivityMode = settings.mode
  const clickSelected = selectedMode === 'click'
  const isRunning = status.phase === 'running'

  async function saveSettings(manageBusy = true): Promise<ActivitySettings | null> {
    if (!Number.isInteger(settings.intervalSeconds) || settings.intervalSeconds < MIN_INTERVAL_SECONDS || settings.intervalSeconds > MAX_INTERVAL_SECONDS) {
      showMessage(`间隔必须是 ${MIN_INTERVAL_SECONDS} 到 ${MAX_INTERVAL_SECONDS} 秒之间的整数。`, true)
      return null
    }
    if (clickSelected && !settings.clickAcknowledged) {
      showMessage('请确认点击模式的影响后再启动。', true)
      return null
    }

    if (manageBusy) setBusy(true)
    try {
      const saved = await keepyApi.saveSettings({
        intervalSeconds: settings.intervalSeconds,
        mode: settings.mode,
        clickAcknowledged: settings.clickAcknowledged
      })
      setSettings(saved)
      setStatus(await keepyApi.getStatus())
      setDirty(false)
      showMessage('设置已保存。', false)
      return saved
    } catch (error) {
      showMessage(errorMessage(error), true)
      return null
    } finally {
      if (manageBusy) setBusy(false)
    }
  }

  async function toggleActivity() {
    setBusy(true)
    try {
      if (isRunning) {
        setStatus(await keepyApi.pause())
        return
      }
      const saved = await saveSettings(false)
      if (saved) setStatus(await keepyApi.start())
    } catch (error) {
      showMessage(errorMessage(error), true)
    } finally {
      setBusy(false)
    }
  }

  function updateSettings(patch: Partial<ActivitySettings>) {
    setSettings((current) => ({ ...current, ...patch }))
    setDirty(true)
  }

  function showMessage(next: string, isError: boolean) {
    setMessage(next)
    setMessageIsError(isError)
  }

  async function resolveClose() {
    if (!closeRequest) return
    closeDialog.current?.close()
    setCloseRequest(null)
    await keepyApi.resolveClose(closeAction, rememberClose)
  }

  if (!loaded) {
    return <main className="shell loading-shell">正在加载 Keepy…</main>
  }

  return (
    <main className="shell">
      <header className="hero">
        <div className="brand-mark" aria-hidden="true">K</div>
        <div>
          <p className="eyebrow">KEEPY</p>
          <h1>鼠标活动助手</h1>
          <p className="subtitle">Windows 托盘工具 · 手动控制</p>
        </div>
      </header>

      <section className="status-card" aria-labelledby="status-title">
        <div className="status-heading">
          <div>
            <p className="section-label">运行状态</p>
            <h2 id="status-title">{statusTitle(status.phase)}</h2>
          </div>
          <span className={`status-pill ${status.phase}`}>{statusPill(status.phase)}</span>
        </div>
        <p className="status-detail">{statusDetail(status)}</p>
        <div className="timeline">
          <div><span className="meta-label">上次动作</span><strong>{formatTime(status.lastActionAt, '尚未执行')}</strong></div>
          <div><span className="meta-label">下次动作</span><strong>{formatTime(status.nextActionAt, '未安排')}</strong></div>
        </div>
        {status.errorMessage && <div className="error-box" role="alert">{status.errorMessage}</div>}
      </section>

      <section className="panel" aria-labelledby="settings-title">
        <div className="panel-heading">
          <div><p className="section-label">活动设置</p><h2 id="settings-title">选择动作与间隔</h2></div>
          <span className={`save-state${dirty ? ' is-dirty' : ''}`}>{dirty ? '未保存' : '已保存'}</span>
        </div>

        <form id="settings-form" onSubmit={(event) => { event.preventDefault(); void saveSettings() }}>
          <label className="field">
            <span>动作间隔</span>
            <div className="number-input">
              <input
                aria-label="动作间隔"
                type="number"
                min={MIN_INTERVAL_SECONDS}
                max={MAX_INTERVAL_SECONDS}
                step="1"
                value={settings.intervalSeconds}
                onChange={(event) => updateSettings({ intervalSeconds: Number(event.target.value) })}
                required
              />
              <span>秒</span>
            </div>
            <small>可设置 10 秒至 1 小时。</small>
          </label>

          <fieldset className="field mode-field">
            <legend>活动方式</legend>
            <label className="mode-option">
              <input type="radio" name="mode" value="move" checked={settings.mode === 'move'} onChange={() => updateSettings({ mode: 'move' })} />
              <span className="option-copy"><strong>轻微移动并还原</strong><small>移动指针 2 像素后自动还原，不会点击当前窗口。</small></span>
            </label>
            <label className="mode-option">
              <input type="radio" name="mode" value="click" checked={settings.mode === 'click'} onChange={() => updateSettings({ mode: 'click' })} />
              <span className="option-copy"><strong>点击当前鼠标位置</strong><small>会影响当前活动窗口，请只在你明确需要时使用。</small></span>
            </label>
          </fieldset>

          {clickSelected && <label className="acknowledgement"><input type="checkbox" checked={settings.clickAcknowledged} onChange={(event) => updateSettings({ clickAcknowledged: event.target.checked })} /><span>我知道点击动作可能影响当前活动窗口，并确认由我承担相应影响。</span></label>}
          <p className={`form-message${messageIsError ? ' is-error' : ''}`} role="status" aria-live="polite">{message}</p>
          <div className="actions"><button className={`primary-button${isRunning ? ' is-pausing' : ''}`} type="button" disabled={busy} onClick={() => void toggleActivity()}>{isRunning ? '暂停 Keepy' : '开始 Keepy'}</button><button className="secondary-button" type="submit" disabled={busy}>保存设置</button></div>
        </form>
      </section>

      <footer className="footer-note"><span className="tray-dot" aria-hidden="true" />关闭窗口不会退出应用，Keepy 会继续在系统托盘中运行。</footer>

      <dialog ref={closeDialog} className="close-dialog" aria-labelledby="close-dialog-title" onCancel={() => { setCloseRequest(null) }}>
        <form method="dialog" onSubmit={(event) => { event.preventDefault(); void resolveClose() }}>
          <p className="section-label">窗口操作</p><h2 id="close-dialog-title">确认关闭</h2><p className="dialog-copy">请选择关闭窗口后的处理方式。</p>
          <fieldset className="close-options">
            <label className="close-option"><input type="radio" name="close-action" value="tray" checked={closeAction === 'tray'} onChange={() => setCloseAction('tray')} /><span><strong>最小化到托盘</strong><small>Keepy 继续运行，可从托盘重新打开。</small></span></label>
            <label className="close-option"><input type="radio" name="close-action" value="quit" checked={closeAction === 'quit'} onChange={() => setCloseAction('quit')} /><span><strong>直接关闭</strong><small>停止 Keepy 并退出应用。</small></span></label>
          </fieldset>
          <label className="remember-close"><input type="checkbox" checked={rememberClose} onChange={(event) => setRememberClose(event.target.checked)} /><span>下次不再提示</span></label>
          <div className="dialog-actions"><button className="secondary-button" type="button" onClick={() => { closeDialog.current?.close(); setCloseRequest(null) }}>取消</button><button className="primary-button" type="submit">确认</button></div>
        </form>
      </dialog>
    </main>
  )
}

function statusTitle(phase: ActivityStatus['phase']) { return phase === 'running' ? '正在运行' : phase === 'error' ? '需要处理' : '已暂停' }
function statusPill(phase: ActivityStatus['phase']) { return phase === 'running' ? '运行中' : phase === 'error' ? '错误' : '暂停' }
function statusDetail(status: ActivityStatus) { return status.phase === 'running' ? `每 ${status.intervalSeconds} 秒执行一次${status.mode === 'move' ? '轻微移动' : '点击'}动作。` : status.phase === 'error' ? '鼠标动作未能完成，Keepy 已暂停。' : '应用会继续驻留在系统托盘中。' }
function formatTime(timestamp: number | null, fallback: string) { return timestamp ? new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(timestamp)) : fallback }
function errorMessage(error: unknown) { return error instanceof Error ? error.message : '操作未能完成。' }
