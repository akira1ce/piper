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

  it('replaces the streaming message on message_end', () => {
    let view = initialChatView()
    view = reduceBatch(
      view,
      batch([
        { type: 'message_start', message: { role: 'assistant', content: [] } },
        { type: 'delta', kind: 'text', contentIndex: 0, text: 'partial' }
      ])
    )
    view = reduceBatch(
      view,
      batch(
        [
          {
            type: 'message_end',
            message: {
              role: 'assistant',
              content: [
                { type: 'thinking', thinking: '想' },
                { type: 'text', text: '权威文本' }
              ]
            }
          }
        ],
        2
      )
    )
    expect(view.messages[0].blocks.map((block) => block.kind)).toEqual(['thinking', 'text'])
    expect(view.messages[0].blocks[1].text).toBe('权威文本')
  })

  it('ignores toolResult and system messages', () => {
    const view = reduceBatch(
      initialChatView(),
      batch([
        { type: 'message_start', message: { role: 'toolResult', content: 'x' } },
        { type: 'message_end', message: { role: 'system', content: 'y' } }
      ])
    )
    expect(view.messages).toHaveLength(0)
  })

  it('tracks retry attempts until success', () => {
    let view = reduceBatch(
      initialChatView(),
      batch([{ type: 'retry', phase: 'start', attempt: 2 }])
    )
    expect(view.retryAttempt).toBe(2)
    view = reduceBatch(view, batch([{ type: 'retry', phase: 'end', success: true }], 2))
    expect(view.retryAttempt).toBeNull()
  })

  it('queues extension dialogs and tracks extension status', () => {
    let view = reduceBatch(
      initialChatView(),
      batch([
        { type: 'extension_ui', request: { id: 'd1', method: 'select', options: ['a', 'b'] } },
        { type: 'extension_ui', request: { id: 'd1', method: 'select', options: ['a', 'b'] } },
        { type: 'extension_ui', request: { id: 's1', method: 'setStatus', statusText: '工作中' } }
      ])
    )
    expect(view.dialogs.map((dialog) => dialog.id)).toEqual(['d1'])
    expect(view.extensionStatus).toBe('工作中')
    view = reduceBatch(
      view,
      batch([{ type: 'extension_ui', request: { id: 's1', method: 'setStatus' } }], 2)
    )
    expect(view.extensionStatus).toBeNull()
  })

  it('rejects stale batches', () => {
    const view = reduceBatch(initialChatView(), batch([{ type: 'agent_start' }], 5))
    const next = reduceBatch(view, batch([{ type: 'settled', aborted: false }], 4))
    expect(next).toBe(view)
  })
})
