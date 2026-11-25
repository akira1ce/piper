import { execFile } from 'node:child_process'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'

export interface ProjectFiles {
  root: string
  files: string[]
  truncated: boolean
  source: 'git' | 'walk' | 'error'
}

export interface FileIndexDeps {
  gitFiles?: (cwd: string) => Promise<string[] | null>
  walk?: (cwd: string, limit: number) => Promise<string[]>
  limit?: number
}

const IGNORED = new Set([
  'node_modules',
  '.git',
  'dist',
  'out',
  '.next',
  'coverage',
  '.venv',
  'venv',
  '.cache',
  '.turbo',
  '.idea',
  '.vscode'
])

const DEFAULT_LIMIT = 5000

function gitFiles(cwd: string): Promise<string[] | null> {
  return new Promise((resolve) => {
    execFile(
      'git',
      ['ls-files', '-co', '--exclude-standard', '-z'],
      { cwd, maxBuffer: 32 * 1024 * 1024 },
      (error, stdout) => {
        if (error) {
          resolve(null)
          return
        }
        resolve(
          stdout
            .split('\0')
            .filter(Boolean)
            .map((path) => path.replace(/\\/g, '/'))
        )
      }
    )
  })
}

async function walkFiles(cwd: string, limit: number): Promise<string[]> {
  const files: string[] = []
  const queue: string[] = ['']

  while (queue.length > 0 && files.length < limit) {
    const relativeDir = queue.shift() as string
    const entries = await readdir(join(cwd, relativeDir), { withFileTypes: true }).catch(() => [])
    entries.sort((a, b) => a.name.localeCompare(b.name))
    for (const entry of entries) {
      if (files.length >= limit) break
      if (entry.name.startsWith('.') && entry.name !== '.env.example') {
        if (entry.isDirectory()) continue
      }
      if (entry.isDirectory()) {
        if (IGNORED.has(entry.name)) continue
        queue.push(relativeDir ? `${relativeDir}/${entry.name}` : entry.name)
      } else if (entry.isFile()) {
        files.push(relativeDir ? `${relativeDir}/${entry.name}` : entry.name)
      }
    }
  }

  return files
}

export async function listProjectFiles(
  cwd: string,
  deps: FileIndexDeps = {}
): Promise<ProjectFiles> {
  const limit = deps.limit ?? DEFAULT_LIMIT
  try {
    const tracked = await (deps.gitFiles ?? gitFiles)(cwd)
    if (tracked && tracked.length > 0) {
      const files = tracked.sort()
      return {
        root: cwd,
        files: files.slice(0, limit),
        truncated: files.length > limit,
        source: 'git'
      }
    }
    const walked = await (deps.walk ?? walkFiles)(cwd, limit)
    return { root: cwd, files: walked, truncated: walked.length >= limit, source: 'walk' }
  } catch {
    return { root: cwd, files: [], truncated: false, source: 'error' }
  }
}
