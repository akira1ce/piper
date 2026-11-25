import type { FileChange, TurnChanges } from '@shared/piProtocol'

export interface PatchLine {
  type: 'hunk' | 'add' | 'del' | 'context'
  text: string
  oldLine: number | null
  newLine: number | null
}

interface ToolInput {
  toolName: string
  args: unknown
  result: unknown
  cwd: string | null
}

export function parsePatch(patch: string): PatchLine[] {
  const out: PatchLine[] = []
  let oldLine = 0
  let newLine = 0

  for (const raw of patch.split('\n')) {
    if (raw.startsWith('--- ') || raw.startsWith('+++ ')) continue
    if (raw.startsWith('@@')) {
      const match = raw.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
      if (match) {
        oldLine = Number(match[1])
        newLine = Number(match[2])
      }
      out.push({ type: 'hunk', text: raw, oldLine: null, newLine: null })
      continue
    }
    if (raw === '') continue
    if (raw.startsWith('\\')) continue

    const marker = raw[0]
    const text = raw.slice(1)
    if (marker === '+') {
      out.push({ type: 'add', text, oldLine: null, newLine: newLine++ })
    } else if (marker === '-') {
      out.push({ type: 'del', text, oldLine: oldLine++, newLine: null })
    } else {
      out.push({ type: 'context', text, oldLine: oldLine++, newLine: newLine++ })
    }
  }
  return out
}

export function countPatch(patch: string): { additions: number; deletions: number } {
  let additions = 0
  let deletions = 0
  for (const line of patch.split('\n')) {
    if (line.startsWith('+++ ') || line.startsWith('--- ') || line.startsWith('@@')) continue
    if (line.startsWith('+')) additions += 1
    else if (line.startsWith('-')) deletions += 1
  }
  return { additions, deletions }
}

export function pathFromPatch(patch: string): string | null {
  for (const line of patch.split('\n')) {
    if (line.startsWith('+++ ')) {
      const value = line.slice(4).trim()
      if (value === '/dev/null') continue
      return value.replace(/^b\//, '')
    }
    if (line.startsWith('--- ')) {
      const value = line.slice(4).trim()
      if (value === '/dev/null') continue
      return value.replace(/^a\//, '')
    }
  }
  return null
}

export function relativizePath(path: string, cwd: string | null): string {
  const normalized = path.replace(/\\/g, '/')
  if (!cwd) return normalized
  const root = cwd.replace(/\\/g, '/').replace(/\/+$/, '')
  if (normalized === root) return normalized
  if (normalized.startsWith(`${root}/`)) return normalized.slice(root.length + 1)
  return normalized
}

export function patchForWrite(path: string, content: string): string {
  const body = content.endsWith('\n') ? content.slice(0, -1) : content
  const lines = body === '' ? [] : body.split('\n')
  const header = [`--- /dev/null`, `+++ b/${path}`, `@@ -0,0 +1,${lines.length} @@`]
  return [...header, ...lines.map((line) => `+${line}`)].join('\n')
}

export function fileChangeFromTool(input: ToolInput): FileChange | null {
  const args = (input.args ?? {}) as { path?: string; content?: string }
  if (input.toolName === 'edit') {
    const details = (input.result as { details?: { patch?: string } } | null)?.details
    const patch = details?.patch
    if (!patch) return null
    const path = pathFromPatch(patch) ?? args.path ?? 'unknown'
    return {
      path: relativizePath(path, input.cwd),
      status: 'modified',
      ...countPatch(patch),
      patch
    }
  }

  if (input.toolName === 'write') {
    if (!args.path || typeof args.content !== 'string') return null
    const path = relativizePath(args.path, input.cwd)
    const patch = patchForWrite(path, args.content)
    return { path, status: 'created', ...countPatch(patch), patch }
  }

  return null
}

export function mergeChanges(files: FileChange[], change: FileChange): FileChange[] {
  const existing = files.find((file) => file.path === change.path)
  if (!existing) return [...files, change]
  return files.map((file) =>
    file.path === change.path
      ? {
          ...file,
          status: file.status === 'created' && change.status === 'created' ? 'created' : 'modified',
          additions: file.additions + change.additions,
          deletions: file.deletions + change.deletions,
          patch: change.patch
        }
      : file
  )
}

export function summarizeChanges(files: FileChange[]): TurnChanges {
  return {
    files,
    additions: files.reduce((total, file) => total + file.additions, 0),
    deletions: files.reduce((total, file) => total + file.deletions, 0)
  }
}
