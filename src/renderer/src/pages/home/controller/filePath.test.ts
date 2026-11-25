import { describe, expect, it } from 'vitest'
import { splitFilePath } from './filePath'

describe('splitFilePath', () => {
  it('splits a nested path into directory and file name', () => {
    expect(splitFilePath('src/renderer/src/pages/home/index.tsx')).toEqual({
      dir: 'src/renderer/src/pages/home/',
      name: 'index.tsx'
    })
  })

  it('returns no directory for a top-level file', () => {
    expect(splitFilePath('AGENTS.md')).toEqual({ dir: '', name: 'AGENTS.md' })
  })

  it('treats a trailing slash as a directory', () => {
    expect(splitFilePath('src/pages/')).toEqual({ dir: 'src/pages/', name: '' })
  })
})
