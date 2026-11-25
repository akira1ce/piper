import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { listProjectFiles } from './fileIndex'

describe('listProjectFiles', () => {
  it('prefers git file listing', async () => {
    const result = await listProjectFiles('/repo', {
      gitFiles: async () => ['src/b.ts', 'a.ts'],
      walk: async () => ['wrong.ts']
    })
    expect(result.source).toBe('git')
    expect(result.files).toEqual(['a.ts', 'src/b.ts'])
  })

  it('falls back to walking when git is unavailable', async () => {
    const result = await listProjectFiles('/repo', {
      gitFiles: async () => null,
      walk: async () => ['src/a.ts']
    })
    expect(result).toMatchObject({ source: 'walk', files: ['src/a.ts'] })
  })

  it('walks a real directory while ignoring heavy folders', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'piper-files-'))
    await mkdir(join(dir, 'src'), { recursive: true })
    await mkdir(join(dir, 'node_modules', 'pkg'), { recursive: true })
    await writeFile(join(dir, 'src', 'a.ts'), '')
    await writeFile(join(dir, 'node_modules', 'pkg', 'index.js'), '')
    const result = await listProjectFiles(dir, { gitFiles: async () => null })
    expect(result.files).toContain('src/a.ts')
    expect(result.files.some((file) => file.includes('node_modules'))).toBe(false)
  })

  it('returns an empty list on failure', async () => {
    const result = await listProjectFiles('/repo', {
      gitFiles: async () => null,
      walk: async () => {
        throw new Error('boom')
      }
    })
    expect(result).toMatchObject({ source: 'error', files: [] })
  })
})
