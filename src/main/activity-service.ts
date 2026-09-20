import type { ActivitySettings, ActivityStatus } from '../shared/types'
import { performActivityAction } from './mouse-driver'
import type { ActivityActionDependencies } from './mouse-driver'

export interface ActivityServiceOptions extends ActivityActionDependencies {
  now?: () => number
  setTimeout?: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>
  clearTimeout?: (handle: ReturnType<typeof setTimeout>) => void
  onStatus?: (status: ActivityStatus) => void
}

export class ActivityService {
  private settings: ActivitySettings
  private phase: ActivityStatus['phase'] = 'paused'
  private lastActionAt: number | null = null
  private nextActionAt: number | null = null
  private errorMessage: string | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private actionInFlight = false
  private readonly now: () => number
  private readonly scheduleTimeout: NonNullable<ActivityServiceOptions['setTimeout']>
  private readonly cancelTimeout: NonNullable<ActivityServiceOptions['clearTimeout']>

  constructor(private readonly options: ActivityServiceOptions, settings: ActivitySettings) {
    this.settings = { ...settings }
    this.now = options.now ?? Date.now
    this.scheduleTimeout = options.setTimeout ?? ((callback, delayMs) => setTimeout(callback, delayMs))
    this.cancelTimeout = options.clearTimeout ?? ((handle) => clearTimeout(handle))
  }

  getStatus(): ActivityStatus {
    return {
      phase: this.phase,
      intervalSeconds: this.settings.intervalSeconds,
      mode: this.settings.mode,
      lastActionAt: this.lastActionAt,
      nextActionAt: this.nextActionAt,
      errorMessage: this.errorMessage
    }
  }

  updateSettings(settings: ActivitySettings): ActivityStatus {
    const wasRunning = this.phase === 'running'
    this.settings = { ...settings }

    if (settings.mode === 'click' && !settings.clickAcknowledged) {
      return this.pause()
    }

    if (wasRunning && !this.actionInFlight) {
      this.scheduleNext()
    } else {
      this.emitStatus()
    }
    return this.getStatus()
  }

  start(): ActivityStatus {
    if (this.phase === 'running') {
      return this.getStatus()
    }

    this.errorMessage = null
    this.phase = 'running'
    this.scheduleNext()
    return this.getStatus()
  }

  pause(): ActivityStatus {
    this.clearScheduledAction()
    this.phase = 'paused'
    this.nextActionAt = null
    this.errorMessage = null
    this.emitStatus()
    return this.getStatus()
  }

  dispose(): void {
    this.clearScheduledAction()
  }

  private scheduleNext(): void {
    this.clearScheduledAction()
    if (this.phase !== 'running') {
      this.emitStatus()
      return
    }

    const delayMs = this.settings.intervalSeconds * 1000
    this.nextActionAt = this.now() + delayMs
    this.timer = this.scheduleTimeout(() => {
      void this.runScheduledAction()
    }, delayMs)
    this.emitStatus()
  }

  private async runScheduledAction(): Promise<void> {
    if (this.phase !== 'running' || this.actionInFlight) {
      return
    }

    this.actionInFlight = true
    this.nextActionAt = null
    this.emitStatus()

    try {
      await performActivityAction(this.settings.mode, this.options)
      this.lastActionAt = this.now()
      this.actionInFlight = false
      if (this.phase === 'running') {
        this.scheduleNext()
      } else {
        this.emitStatus()
      }
    } catch (error) {
      this.actionInFlight = false
      this.phase = 'error'
      this.nextActionAt = null
      this.errorMessage = error instanceof Error ? error.message : '执行鼠标动作失败。'
      this.emitStatus()
    }
  }

  private clearScheduledAction(): void {
    if (this.timer !== null) {
      this.cancelTimeout(this.timer)
      this.timer = null
    }
  }

  private emitStatus(): void {
    this.options.onStatus?.(this.getStatus())
  }
}
