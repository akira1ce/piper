import { describe, expect, it } from 'vitest'
import type { MessageView, TurnChanges } from '@shared/piProtocol'
import { aggregateTurnChanges } from './aggregateTurnChanges'

const change = (path: string, additions: number): TurnChanges => ({
  files: [
    {
      path,
      status: 'modified',
      additions,
      deletions: 0,
      patch: `+${path}`
    }
  ],
  additions,
  deletions: 0
})

const message = (role: MessageView['role'], changes?: TurnChanges): MessageView => ({
  id: `${role}_${Math.random()}`,
  role,
  blocks: [],
  ...(changes ? { changes } : {})
})

describe('aggregateTurnChanges', () => {
  it('moves all changes in a turn onto its last assistant message', () => {
    const messages = [
      message('user'),
      message('assistant', change('first.ts', 2)),
      message('assistant', change('second.ts', 3))
    ]

    const result = aggregateTurnChanges(messages)

    expect(result[1].changes).toBeUndefined()
    expect(result[2].changes?.files.map((file) => file.path)).toEqual(['first.ts', 'second.ts'])
    expect(result[2].changes?.additions).toBe(5)
  })

  it('does not merge changes across user message boundaries', () => {
    const messages = [
      message('user'),
      message('assistant', change('first.ts', 2)),
      message('user'),
      message('assistant', change('second.ts', 3))
    ]

    const result = aggregateTurnChanges(messages)

    expect(result[1].changes?.files.map((file) => file.path)).toEqual(['first.ts'])
    expect(result[3].changes?.files.map((file) => file.path)).toEqual(['second.ts'])
  })

  it('does not mutate the input messages', () => {
    const first = message('assistant', change('first.ts', 2))
    const last = message('assistant', change('second.ts', 3))
    const messages = [message('user'), first, last]

    aggregateTurnChanges(messages)

    expect(first.changes?.files).toHaveLength(1)
    expect(last.changes?.files).toHaveLength(1)
  })
})
