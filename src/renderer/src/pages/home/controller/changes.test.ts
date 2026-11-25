import { describe, expect, it } from 'vitest'
import {
  countPatch,
  fileChangeFromTool,
  mergeChanges,
  parsePatch,
  pathFromPatch,
  relativizePath,
  summarizeChanges
} from './changes'

const patch = [
  '--- a/src/a.ts',
  '+++ b/src/a.ts',
  '@@ -1,2 +1,2 @@',
  ' const a = 1',
  '-const b = 2',
  '+const b = 3'
].join('\n')

describe('changes', () => {
  it('counts additions and deletions without file headers', () => {
    expect(countPatch(patch)).toEqual({ additions: 1, deletions: 1 })
  })

  it('parses hunks with line numbers', () => {
    const lines = parsePatch(patch)
    expect(lines.map((line) => line.type)).toEqual(['hunk', 'context', 'del', 'add'])
    expect(lines[1]).toMatchObject({ oldLine: 1, newLine: 1 })
    expect(lines[2]).toMatchObject({ oldLine: 2, newLine: null })
    expect(lines[3]).toMatchObject({ oldLine: null, newLine: 2 })
  })

  it('reads the path from the patch header', () => {
    expect(pathFromPatch(patch)).toBe('src/a.ts')
  })

  it('relativizes absolute paths', () => {
    expect(relativizePath('/repo/src/a.ts', '/repo')).toBe('src/a.ts')
    expect(relativizePath('/repo-other/a.ts', '/repo')).toBe('/repo-other/a.ts')
  })

  it('builds a created-file change for write tools', () => {
    const change = fileChangeFromTool({
      toolName: 'write',
      args: { path: '/repo/new.md', content: 'hello\nworld\n' },
      result: null,
      cwd: '/repo'
    })
    expect(change).toMatchObject({ path: 'new.md', status: 'created', additions: 2, deletions: 0 })
    expect(change?.patch).toContain('+hello')
  })

  it('builds a modified-file change for edit tools', () => {
    const change = fileChangeFromTool({
      toolName: 'edit',
      args: { path: 'src/a.ts' },
      result: { details: { patch } },
      cwd: '/repo'
    })
    expect(change).toMatchObject({
      path: 'src/a.ts',
      status: 'modified',
      additions: 1,
      deletions: 1
    })
  })

  it('merges repeated edits of the same path', () => {
    const files = mergeChanges(
      [{ path: 'a.ts', status: 'modified', additions: 1, deletions: 0, patch: 'p1' }],
      { path: 'a.ts', status: 'modified', additions: 2, deletions: 1, patch: 'p2' }
    )
    expect(files).toHaveLength(1)
    expect(files[0]).toMatchObject({ additions: 3, deletions: 1, patch: 'p2' })
    expect(summarizeChanges(files)).toMatchObject({ additions: 3, deletions: 1 })
  })
})
