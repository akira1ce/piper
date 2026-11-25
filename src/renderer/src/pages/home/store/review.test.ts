import { describe, expect, it } from 'vitest'
import { ACCORDION_LIMIT, defaultReviewMode } from './review'

describe('defaultReviewMode', () => {
  it('uses accordion up to the limit', () => {
    expect(defaultReviewMode(1)).toBe('accordion')
    expect(defaultReviewMode(ACCORDION_LIMIT)).toBe('accordion')
  })

  it('switches to the tree beyond the limit', () => {
    expect(defaultReviewMode(ACCORDION_LIMIT + 1)).toBe('tree')
    expect(defaultReviewMode(40)).toBe('tree')
  })
})
