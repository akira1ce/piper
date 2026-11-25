import { describe, expect, it } from 'vitest'
import { expandablePaths, toggleAllPaths } from './expandAll'

describe('expandablePaths', () => {
  it('starts every file expanded', () => {
    expect(expandablePaths(['a.ts', 'b.ts'])).toEqual(['a.ts', 'b.ts'])
  })

  it('collapses every file when all are already expanded', () => {
    expect(toggleAllPaths(['a.ts', 'b.ts'], ['a.ts', 'b.ts'])).toEqual([])
  })

  it('expands every file when some are collapsed', () => {
    expect(toggleAllPaths(['a.ts', 'b.ts'], ['a.ts'])).toEqual(['a.ts', 'b.ts'])
  })

  it('treats an empty list as fully collapsed', () => {
    expect(toggleAllPaths(['a.ts', 'b.ts'], [])).toEqual(['a.ts', 'b.ts'])
  })
})
