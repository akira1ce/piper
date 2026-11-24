import { describe, expect, it } from 'vitest'
import { mapRecord } from './mapRecord'

describe('mapRecord', () => {
  it('maps text deltas and authoritative block ends', () => {
    expect(
      mapRecord({
        type: 'message_update',
        assistantMessageEvent: { type: 'text_delta', contentIndex: 0, delta: 'hi' }
      })
    ).toEqual([{ type: 'delta', kind: 'text', contentIndex: 0, text: 'hi' }])
    expect(
      mapRecord({
        type: 'message_update',
        assistantMessageEvent: { type: 'text_end', contentIndex: 0, content: 'hi' }
      })
    ).toEqual([{ type: 'block_end', kind: 'text', contentIndex: 0, content: 'hi' }])
  })

  it('maps thinking and toolcall deltas', () => {
    expect(
      mapRecord({
        type: 'message_update',
        assistantMessageEvent: { type: 'thinking_delta', contentIndex: 1, delta: 'hm' }
      })
    ).toEqual([{ type: 'delta', kind: 'thinking', contentIndex: 1, text: 'hm' }])
    expect(
      mapRecord({
        type: 'message_update',
        assistantMessageEvent: {
          type: 'toolcall_start',
          contentIndex: 2,
          id: 'call_1',
          toolName: 'bash'
        }
      })
    ).toEqual([
      { type: 'delta', kind: 'toolcall', contentIndex: 2, toolCallId: 'call_1', toolName: 'bash' }
    ])
  })

  it('maps tool execution lifecycle', () => {
    expect(
      mapRecord({
        type: 'tool_execution_start',
        toolCallId: 'c1',
        toolName: 'bash',
        args: { command: 'ls' }
      })
    ).toEqual([{ type: 'tool_start', toolCallId: 'c1', toolName: 'bash', args: { command: 'ls' } }])
    expect(
      mapRecord({ type: 'tool_execution_update', toolCallId: 'c1', partialResult: { content: [] } })
    ).toEqual([{ type: 'tool_update', toolCallId: 'c1', partialResult: { content: [] } }])
    expect(
      mapRecord({
        type: 'tool_execution_end',
        toolCallId: 'c1',
        result: { content: [] },
        isError: false,
        durationMs: 12
      })
    ).toEqual([
      {
        type: 'tool_end',
        toolCallId: 'c1',
        result: { content: [] },
        isError: false,
        durationMs: 12
      }
    ])
  })

  it('maps run boundaries, queue and extension UI', () => {
    expect(mapRecord({ type: 'agent_settled', aborted: true })).toEqual([
      { type: 'settled', aborted: true }
    ])
    expect(mapRecord({ type: 'agent_end', messages: [], willRetry: true })).toEqual([
      { type: 'agent_end', willRetry: true }
    ])
    expect(mapRecord({ type: 'queue_update', steering: ['a'], followUp: [] })).toEqual([
      { type: 'queue', steering: ['a'], followUp: [] }
    ])
    expect(
      mapRecord({
        type: 'extension_ui_request',
        id: 'd1',
        method: 'confirm',
        title: 'ok?',
        message: 'sure'
      })
    ).toEqual([
      {
        type: 'extension_ui',
        request: { id: 'd1', method: 'confirm', title: 'ok?', message: 'sure' }
      }
    ])
  })

  it('ignores unknown records', () => {
    expect(mapRecord({ type: 'something_else' })).toEqual([])
  })
})
