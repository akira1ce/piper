import { describe, expect, it } from 'vitest'
import { formatContext, formatCost, formatTokens } from './formatStats'

describe('formatStats', () => {
  it('formats token counts compactly', () => {
    expect(formatTokens(999)).toBe('999')
    expect(formatTokens(12_400)).toBe('12.4k')
    expect(formatTokens(105_000)).toBe('105k')
  })

  it('formats cost with 2 decimals', () => {
    expect(formatCost(0.4567)).toBe('$0.46')
    expect(formatCost(0)).toBe('$0.00')
  })

  it('formats context usage', () => {
    expect(formatContext({ tokens: 60_000, contextWindow: 200_000, percent: 30 })).toBe(
      '60k / 200k · 30%'
    )
    expect(formatContext({ tokens: null, contextWindow: 200_000, percent: null })).toBe('—')
  })
})
