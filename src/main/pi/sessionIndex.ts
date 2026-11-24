import { readdir, readFile, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { SessionSummary } from '@shared/piProtocol'

export function resolveSessionsDir(
  env: Record<string, string | undefined>,
  home = homedir()
): string {
  return env.PI_CODING_AGENT_SESSION_DIR ?? join(home, '.pi', 'agent', 'sessions')
}

export interface SessionIndexOptions {
  sessionsDir: string
  concurrency?: number
}

const cache = new Map<string, { mtime: number; size: number; summary: SessionSummary | null }>()

export class SessionIndex {
  constructor(private options: SessionIndexOptions) {}

  async list(): Promise<SessionSummary[]> {
    const groups = await readdir(this.options.sessionsDir, { withFileTypes: true }).catch(() => [])
    const files: string[] = []
    for (const group of groups) {
      if (!group.isDirectory() || !group.name.startsWith('--')) continue
      const entries = await readdir(join(this.options.sessionsDir, group.name), {
        withFileTypes: true
      })
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.jsonl')) {
          files.push(join(this.options.sessionsDir, group.name, entry.name))
        }
      }
    }

    const summaries: SessionSummary[] = []
    const limit = this.options.concurrency ?? 8
    for (let i = 0; i < files.length; i += limit) {
      const batch = await Promise.all(
        files.slice(i, i + limit).map((file) => this.readSummary(file))
      )
      for (const summary of batch) if (summary) summaries.push(summary)
    }
    return summaries.sort((a, b) => b.modified - a.modified)
  }

  private async readSummary(path: string): Promise<SessionSummary | null> {
    const info = await stat(path).catch(() => null)
    if (!info) return null
    const cached = cache.get(path)
    if (cached && cached.mtime === info.mtimeMs && cached.size === info.size) return cached.summary

    const text = await readFile(path, 'utf8').catch(() => '')
    const lines = text.split('\n')
    let header: { type?: string; id?: string; cwd?: string; version?: number } | null = null
    let name: string | undefined
    let firstMessage = ''
    let messageCount = 0

    for (const line of lines) {
      if (!line) continue
      let entry: { type?: string; name?: unknown; message?: { role?: string; content?: unknown } }
      try {
        entry = JSON.parse(line)
      } catch {
        continue
      }
      if (!header) {
        if (entry.type !== 'session') return this.remember(path, info.mtimeMs, info.size, null)
        header = entry
        continue
      }
      if (entry.type === 'message') messageCount += 1
      if (entry.type === 'session_info' && typeof entry.name === 'string') name = entry.name
      if (!firstMessage && entry.type === 'message' && entry.message?.role === 'user') {
        firstMessage = toText(entry.message.content).slice(0, 120)
      }
    }

    if (!header || typeof header.id !== 'string' || typeof header.cwd !== 'string') {
      return this.remember(path, info.mtimeMs, info.size, null)
    }

    const summary: SessionSummary = {
      path,
      id: header.id,
      cwd: header.cwd,
      name,
      modified: info.mtimeMs,
      messageCount,
      firstMessage
    }
    return this.remember(path, info.mtimeMs, info.size, summary)
  }

  private remember(
    path: string,
    mtime: number,
    size: number,
    summary: SessionSummary | null
  ): SessionSummary | null {
    cache.set(path, { mtime, size, summary })
    return summary
  }
}

function toText(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((block) => {
        const text = (block as { text?: unknown } | null)?.text
        return typeof text === 'string' ? text : ''
      })
      .filter(Boolean)
      .join(' ')
  }
  return ''
}
