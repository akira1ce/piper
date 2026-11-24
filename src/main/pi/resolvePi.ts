export interface ResolveOptions {
  env: Record<string, string | undefined>
  pathEnv: string
  exists: (path: string) => boolean
  platform?: NodeJS.Platform
}

export function resolvePiPath(options: ResolveOptions): string | null {
  const override = options.env.PIPER_PI_PATH
  if (override && options.exists(override)) return override

  const platform = options.platform ?? process.platform
  const name = platform === 'win32' ? 'pi.cmd' : 'pi'
  const separator = platform === 'win32' ? ';' : ':'
  for (const dir of options.pathEnv.split(separator)) {
    if (!dir) continue
    const candidate = `${dir.replace(/[\\/]$/, '')}/${name}`
    if (options.exists(candidate)) return candidate
  }
  return null
}

export function compareVersion(a: string, b: string): number {
  const left = a.split('.').map((part) => Number.parseInt(part, 10))
  const right = b.split('.').map((part) => Number.parseInt(part, 10))
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const l = Number.isNaN(left[i]) ? 0 : (left[i] ?? 0)
    const r = Number.isNaN(right[i]) ? 0 : (right[i] ?? 0)
    if (l !== r) return l - r
  }
  return 0
}

export function isVersionSupported(version: string, minimum = '1.6.0'): boolean {
  if (!/^\d+(\.\d+){0,2}/.test(version)) return false
  return compareVersion(version, minimum) >= 0
}
