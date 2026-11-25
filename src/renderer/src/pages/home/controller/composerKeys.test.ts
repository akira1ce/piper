import { describe, expect, it } from 'vitest'
import { shouldSubmitOnEnter } from './composerKeys'

const base = { key: 'Enter', shiftKey: false, isComposing: false }

describe('shouldSubmitOnEnter', () => {
  it('submits on plain Enter', () => {
    expect(shouldSubmitOnEnter(base)).toBe(true)
  })

  it('does not submit while an IME composition is active', () => {
    expect(shouldSubmitOnEnter({ ...base, isComposing: true })).toBe(false)
  })

  it('does not submit on the 229 keyCode used by some IMEs', () => {
    expect(shouldSubmitOnEnter({ ...base, keyCode: 229 })).toBe(false)
  })

  it('keeps Shift+Enter as a newline', () => {
    expect(shouldSubmitOnEnter({ ...base, shiftKey: true })).toBe(false)
  })

  it('ignores other keys', () => {
    expect(shouldSubmitOnEnter({ ...base, key: 'a' })).toBe(false)
  })
})
