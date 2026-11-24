import { resolve, sep } from 'node:path'

export function isInsideSessionsDir(sessionPath: string, sessionsDir: string): boolean {
  const root = resolve(sessionsDir)
  const target = resolve(sessionPath)
  if (!target.startsWith(root + sep)) return false
  return target.endsWith('.jsonl')
}
