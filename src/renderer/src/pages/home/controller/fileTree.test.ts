import { describe, expect, it } from 'vitest'
import { buildTree } from './fileTree'

describe('buildTree', () => {
  it('nests files under directories and sorts dirs first', () => {
    const tree = buildTree(['src/b.ts', 'src/a.ts', 'README.md', 'docs/guide.md'])
    expect(tree.map((node) => node.name)).toEqual(['docs', 'src', 'README.md'])
    const src = tree.find((node) => node.name === 'src')
    expect(src?.children.map((node) => node.name)).toEqual(['a.ts', 'b.ts'])
    expect(src?.children[0]).toMatchObject({ path: 'src/a.ts', isFile: true })
  })

  it('does not confuse a file and a directory with the same name', () => {
    const tree = buildTree(['a', 'a/b.ts'])
    expect(tree).toHaveLength(2)
    expect(tree.map((node) => node.isFile)).toEqual([false, true])
  })
})
