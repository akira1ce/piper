import { beforeEach, describe, expect, it } from 'vitest'
import { uiActions, useUiStore } from './ui'

describe('right panel visibility', () => {
  beforeEach(() => useUiStore.setState({ diffVisible: false }))

  it('opens the panel when requested', () => {
    uiActions.showDiff()

    expect(useUiStore.getState().diffVisible).toBe(true)
  })

  it('keeps the panel open when already visible', () => {
    useUiStore.setState({ diffVisible: true })

    uiActions.showDiff()

    expect(useUiStore.getState().diffVisible).toBe(true)
  })

  it('toggles the panel visibility', () => {
    uiActions.toggleDiff()

    expect(useUiStore.getState().diffVisible).toBe(true)
  })
})
