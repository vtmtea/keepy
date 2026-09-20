import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { DEFAULT_SETTINGS, readStoredSettings, createSettings } from '../shared/settings'
import type { ActivitySettings, ActivitySettingsInput } from '../shared/types'

export class SettingsStore {
  private settings: ActivitySettings = { ...DEFAULT_SETTINGS }
  private loaded = false

  constructor(private readonly filePath: string) {}

  async load(): Promise<ActivitySettings> {
    if (this.loaded) {
      return { ...this.settings }
    }

    try {
      const raw = await readFile(this.filePath, 'utf8')
      this.settings = readStoredSettings(JSON.parse(raw) as unknown)
    } catch {
      this.settings = { ...DEFAULT_SETTINGS }
    }

    this.loaded = true
    return { ...this.settings }
  }

  async save(input: ActivitySettingsInput): Promise<ActivitySettings> {
    const next = createSettings(input)
    await mkdir(dirname(this.filePath), { recursive: true })
    await writeFile(this.filePath, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
    this.settings = next
    this.loaded = true
    return { ...next }
  }

  get path(): string {
    return this.filePath
  }
}

export function settingsPath(userDataPath: string): string {
  return join(userDataPath, 'settings.json')
}
