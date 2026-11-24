import { stat } from 'node:fs/promises'
import { BrowserWindow, dialog, ipcMain, shell, type OpenDialogOptions } from 'electron'
import type { PiCommand, PiResult } from '@shared/piProtocol'
import type { PiGateway } from './pi/piGateway'
import type { SessionIndex } from './pi/sessionIndex'
import type { ProjectRegistry } from './projects'
import type { AppStateStore } from './appState'
import { isInsideSessionsDir } from './ipcPaths'

export const INVOKE_CHANNEL = 'piper:invoke'
export const EVENT_CHANNEL = 'piper:event'

const COMMANDS = new Set<PiCommand['type']>([
  'start',
  'stop',
  'prompt',
  'abort',
  'abortRetry',
  'clearQueue',
  'state',
  'messages',
  'models',
  'setModel',
  'thinkingLevels',
  'setThinkingLevel',
  'stats',
  'newSession',
  'switchSession',
  'renameSession',
  'sessions',
  'projects',
  'addProject',
  'removeProject',
  'renameProject',
  'pickDirectory',
  'lastSession',
  'rememberSession',
  'deleteSession',
  'extensionRespond'
])

export function isKnownCommand(value: unknown): value is PiCommand {
  if (!value || typeof value !== 'object') return false
  const type = (value as { type?: unknown }).type
  return typeof type === 'string' && COMMANDS.has(type as PiCommand['type'])
}

export interface IpcDeps {
  gateway: PiGateway
  sessions: SessionIndex
  projects: ProjectRegistry
  appState: AppStateStore
  sessionsDir: string
  getWindow: () => BrowserWindow | null
}

export function registerPiIpc(deps: IpcDeps): void {
  ipcMain.handle(INVOKE_CHANNEL, async (_event, command: unknown): Promise<PiResult> => {
    if (!isKnownCommand(command)) return { ok: false, error: 'unknown command' }
    try {
      return await route(deps, command)
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  })
}

async function route(deps: IpcDeps, command: PiCommand): Promise<PiResult> {
  switch (command.type) {
    case 'projects':
      return { ok: true, data: await deps.projects.list() }
    case 'addProject': {
      const window = deps.getWindow()
      const options: OpenDialogOptions = {
        properties: ['openDirectory', 'createDirectory']
      }
      const picked = window
        ? await dialog.showOpenDialog(window, options)
        : await dialog.showOpenDialog(options)
      if (picked.canceled || picked.filePaths.length === 0) return { ok: false, error: 'cancelled' }
      return { ok: true, data: await deps.projects.add(picked.filePaths[0]) }
    }
    case 'removeProject':
      await deps.projects.remove(command.projectId)
      return { ok: true, data: null }
    case 'renameProject':
      return { ok: true, data: await deps.projects.rename(command.projectId, command.name) }
    case 'sessions': {
      const projects = await deps.projects.list()
      const project = projects.find((item) => item.id === command.projectId)
      if (!project) return { ok: false, error: 'project not found' }
      const all = await deps.sessions.list()
      return { ok: true, data: all.filter((session) => samePath(session.cwd, project.path)) }
    }
    case 'start':
      await stat(command.cwd).catch(() => {
        throw new Error('目录不存在')
      })
      return deps.gateway.handle(command)
    case 'prompt':
      if (!command.text.trim()) return { ok: false, error: '消息不能为空' }
      return deps.gateway.handle(command)
    case 'deleteSession':
      if (!isInsideSessionsDir(command.sessionPath, deps.sessionsDir)) {
        return { ok: false, error: '非法会话路径' }
      }
      await shell.trashItem(command.sessionPath)
      return { ok: true, data: null }
    case 'lastSession':
      return { ok: true, data: await deps.appState.get() }
    case 'rememberSession':
      await deps.appState.remember(command.projectId, command.sessionPath)
      return { ok: true, data: null }
    case 'pickDirectory': {
      const picked = await dialog.showOpenDialog({ properties: ['openDirectory'] })
      return { ok: true, data: picked.canceled ? null : picked.filePaths[0] }
    }
    default:
      return deps.gateway.handle(command)
  }
}

function samePath(a: string, b: string): boolean {
  const left = a.replace(/[\\/]+$/, '')
  const right = b.replace(/[\\/]+$/, '')
  return process.platform === 'win32' || process.platform === 'darwin'
    ? left.toLowerCase() === right.toLowerCase()
    : left === right
}
