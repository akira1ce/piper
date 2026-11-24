import { describe, expect, it } from 'vitest'
import { THINKING_LEVELS, type ThinkingLevel } from '@shared/piProtocol'

describe('piProtocol', () => {
  it('exposes every thinking level once', () => {
    expect(THINKING_LEVELS).toEqual(['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'])
    expect(new Set(THINKING_LEVELS).size).toBe(THINKING_LEVELS.length)
  })

  it('narrows thinking level type', () => {
    const level: ThinkingLevel = 'medium'
    expect(THINKING_LEVELS).toContain(level)
  })
})
