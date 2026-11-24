import { readJsonFile, writeJsonFile } from './settings'

export interface AppState {
  lastProjectId?: string
  lastSessionPath?: string
}

export class AppStateStore {
  private state: AppState = {}
  private loaded = false

  constructor(private options: { filePath: string }) {}

  async get(): Promise<AppState> {
    if (!this.loaded) {
      this.state = await readJsonFile<AppState>(this.options.filePath, {})
      this.loaded = true
    }
    return this.state
  }

  async remember(projectId: string, sessionPath: string): Promise<void> {
    const state = await this.get()
    this.state = { ...state, lastProjectId: projectId, lastSessionPath: sessionPath }
    await writeJsonFile(this.options.filePath, this.state)
  }

  async clear(): Promise<void> {
    this.state = {}
    this.loaded = true
    await writeJsonFile(this.options.filePath, this.state)
  }
}
