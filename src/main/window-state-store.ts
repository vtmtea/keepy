import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export const WINDOW_STATE_VERSION = 1
export const DEFAULT_WINDOW_WIDTH = 780
export const DEFAULT_WINDOW_HEIGHT = 650
export const MIN_WINDOW_WIDTH = 620
export const MIN_WINDOW_HEIGHT = 560

export type CloseAction = 'quit' | 'tray'

export interface WindowState {
  version: typeof WINDOW_STATE_VERSION
  width: number
  height: number
  closeAction: CloseAction
  promptOnClose: boolean
}

export const DEFAULT_WINDOW_STATE: WindowState = {
  version: WINDOW_STATE_VERSION,
  width: DEFAULT_WINDOW_WIDTH,
  height: DEFAULT_WINDOW_HEIGHT,
  closeAction: 'tray',
  promptOnClose: true
}

export interface WindowStateInput {
  width?: number
  height?: number
  closeAction?: CloseAction
  promptOnClose?: boolean
}

export class WindowStateStore {
  private state: WindowState = { ...DEFAULT_WINDOW_STATE }
  private loaded = false

  constructor(private readonly filePath: string) {}

  async load(): Promise<WindowState> {
    if (this.loaded) {
      return this.get()
    }

    try {
      this.state = readStoredWindowState(JSON.parse(readFileSync(this.filePath, 'utf8')) as unknown)
    } catch {
      this.state = { ...DEFAULT_WINDOW_STATE }
    }

    this.loaded = true
    return this.get()
  }

  async save(input: WindowStateInput): Promise<WindowState> {
    const next = mergeWindowState(this.state, input)
    this.write(next)
    return this.get()
  }

  saveSync(input: WindowStateInput): WindowState {
    const next = mergeWindowState(this.state, input)
    this.write(next)
    return this.get()
  }

  get(): WindowState {
    return { ...this.state }
  }

  get path(): string {
    return this.filePath
  }

  private write(next: WindowState): void {
    mkdirSync(dirname(this.filePath), { recursive: true })
    writeFileSync(this.filePath, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
    this.state = next
    this.loaded = true
  }
}

export function windowStatePath(userDataPath: string): string {
  return join(userDataPath, 'window-state.json')
}

export function readStoredWindowState(input: unknown): WindowState {
  if (!isRecord(input) || input.version !== WINDOW_STATE_VERSION) {
    return { ...DEFAULT_WINDOW_STATE }
  }

  return mergeWindowState(DEFAULT_WINDOW_STATE, input)
}

function mergeWindowState(base: WindowState, input: WindowStateInput | Record<string, unknown>): WindowState {
  const width = typeof input.width === 'number' && Number.isInteger(input.width)
    ? input.width
    : base.width
  const height = typeof input.height === 'number' && Number.isInteger(input.height)
    ? input.height
    : base.height
  const closeAction = input.closeAction === 'quit' || input.closeAction === 'tray'
    ? input.closeAction
    : base.closeAction
  const promptOnClose = typeof input.promptOnClose === 'boolean'
    ? input.promptOnClose
    : base.promptOnClose

  return {
    version: WINDOW_STATE_VERSION,
    width: isValidWidth(width) ? width : base.width,
    height: isValidHeight(height) ? height : base.height,
    closeAction,
    promptOnClose
  }
}

function isValidWidth(value: number): boolean {
  return value >= MIN_WINDOW_WIDTH && value <= 3840
}

function isValidHeight(value: number): boolean {
  return value >= MIN_WINDOW_HEIGHT && value <= 2160
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
