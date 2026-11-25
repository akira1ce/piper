import { describe, expect, it } from 'vitest'
import { getMentionContext, rankFiles, scoreFile } from './fileMention'

describe('getMentionContext', () => {
  it('detects a mention token starting at the caret', () => {
    expect(getMentionContext('hello @src/co', 13)).toEqual({ start: 6, query: 'src/co' })
  })

  it('detects a mention at the very beginning', () => {
    expect(getMentionContext('@a', 2)).toEqual({ start: 0, query: 'a' })
  })

  it('treats a bare @ as an empty query', () => {
    expect(getMentionContext('look @', 6)).toEqual({ start: 5, query: '' })
  })

  it('ignores @ embedded in a word (e.g. an email)', () => {
    expect(getMentionContext('foo@bar', 7)).toBeNull()
  })

  it('stops the token at whitespace', () => {
    expect(getMentionContext('hello @ src', 11)).toBeNull()
  })

  it('only looks at the text before the caret', () => {
    expect(getMentionContext('@a b', 2)).toEqual({ start: 0, query: 'a' })
  })

  it('returns null when there is no mention', () => {
    expect(getMentionContext('plain text', 10)).toBeNull()
  })
})

describe('scoreFile', () => {
  it('matches a subsequence case-insensitively', () => {
    expect(scoreFile('HomePersonalPanel.tsx', 'homeperpanel')).not.toBeNull()
  })

  it('returns null when the query is not a subsequence', () => {
    expect(scoreFile('README.md', 'xyz')).toBeNull()
  })

  it('scores a consecutive run higher than a scattered match', () => {
    const consecutive = scoreFile('abc.ts', 'abc')!
    const scattered = scoreFile('a-b-c.ts', 'abc')!
    expect(consecutive).toBeGreaterThan(scattered)
  })

  it('scores a basename match higher than a deep path match', () => {
    const base = scoreFile('button.tsx', 'button')!
    const deep = scoreFile('src/components/ui/button.tsx', 'button')!
    expect(base).toBeGreaterThan(deep)
  })

  it('matches an empty query with a neutral score', () => {
    expect(scoreFile('anything', '')).toBe(0)
  })
})

describe('rankFiles', () => {
  const files = ['HomePersonalPanel.tsx', 'src/components/Home.tsx', 'README.md', 'home.ts']

  it('ranks fuzzy filename matches first', () => {
    const ranked = rankFiles(files, 'homeperpanel')
    expect(ranked[0]).toBe('HomePersonalPanel.tsx')
    expect(ranked).toHaveLength(1)
  })

  it('returns every file for an empty query', () => {
    expect(rankFiles(files, '')).toHaveLength(files.length)
  })

  it('honours the limit', () => {
    expect(rankFiles(files, '', 2)).toHaveLength(2)
  })

  it('returns nothing when no file matches', () => {
    expect(rankFiles(files, 'zzz')).toEqual([])
  })
})
