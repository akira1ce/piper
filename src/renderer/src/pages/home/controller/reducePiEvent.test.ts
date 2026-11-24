import { describe, expect, it } from 'vitest'
import type { PiBatch } from '@shared/piProtocol'
import { initialChatView, reduceBatch } from './reducePiEvent'

const batch = (events: PiBatch['events'], seq = 1): PiBatch => ({ seq, events })

describe('reduceBatch', () => {
  it('appends text deltas to the streaming assistant message', () => {
    let view = initialChatView()
    view = reduceBatch(
      view,
      batch([
        { type: 'message_start', message: { role: 'assistant', content: [], id: 'm1' } },
        { type: 'delta', kind: 'text', contentIndex: 0, text: 'hel' },
        { type: 'delta', kind: 'text', contentIndex: 0, text: 'lo' }
      ])
    )
    expect(view.messages[0].blocks[0]).toMatchObject({
      kind: 'text',
      text: 'hello',
      streaming: true
    })
  })

  it('replaces streamed text with authoritative content', () => {
    let view = initialChatView()
    view = reduceBatch(
      view,
      batch([
        { type: 'message_start', message: { role: 'assistant', content: [], id: 'm1' } },
        { type: 'delta', kind: 'text', contentIndex: 0, text: 'he' },
        { type: 'block_end', kind: 'text', contentIndex: 0, content: 'hello world' }
      ])
    )
    expect(view.messages[0].blocks[0]).toMatchObject({ text: 'hello world', streaming: false })
  })

  it('tracks tool lifecycle by toolCallId', () => {
    let view = initialChatView()
    view = reduceBatch(
      view,
      batch([
        { type: 'tool_start', toolCallId: 'c1', toolName: 'bash', args: { command: 'ls' } },
        { type: 'tool_end', toolCallId: 'c1', result: {}, isError: false, durationMs: 12 }
      ])
    )
    expect(view.toolCalls.c1).toMatchObject({ state: 'done', durationMs: 12 })
  })

  it('goes idle only on settled', () => {
    let view = initialChatView()
    view = reduceBatch(view, batch([{ type: 'agent_start' }]))
    expect(view.status).toBe('running')
    view = reduceBatch(view, batch([{ type: 'agent_end', willRetry: false }], 2))
    expect(view.status).toBe('running')
    view = reduceBatch(view, batch([{ type: 'settled', aborted: false }], 3))
    expect(view.status).toBe('idle')
  })

  it('rejects stale batches', () => {
    const view = reduceBatch(initialChatView(), batch([{ type: 'agent_start' }], 5))
    const next = reduceBatch(view, batch([{ type: 'settled', aborted: false }], 4))
    expect(next).toBe(view)
  })
})
