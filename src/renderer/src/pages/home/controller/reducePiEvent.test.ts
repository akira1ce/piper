import { describe, expect, it } from 'vitest'
import type { PiBatch } from '@shared/piProtocol'
import { initialChatView, reduceBatch } from './reducePiEvent'

const editTool = (toolCallId: string, path: string, additions: number): PiBatch => ({
  seq: Number(toolCallId),
  events: [
    { type: 'tool_start', toolCallId, toolName: 'write', args: { path, content: 'new' } },
    {
      type: 'tool_end',
      toolCallId,
      toolName: 'write',
      result: {
        details: { patch: `--- /dev/null\n+++ b/${path}\n@@ -0,0 +1,${additions} @@\n+new` }
      },
      isError: false
    }
  ]
})

describe('reduceBatch turn change summaries', () => {
  it('keeps one summary on the last assistant message in a turn', () => {
    const first = reduceBatch(initialChatView(), {
      seq: 1,
      events: [
        { type: 'message_end', message: { role: 'user', content: 'make changes' } },
        { type: 'message_start', message: { role: 'assistant', content: [] } },
        { type: 'message_end', message: { role: 'assistant', content: 'first pass' } }
      ]
    })
    const afterFirstEdit = reduceBatch(first, editTool('2', 'first.ts', 1))
    const afterSecondAssistant = reduceBatch(afterFirstEdit, {
      seq: 3,
      events: [
        { type: 'message_start', message: { role: 'assistant', content: [] } },
        { type: 'message_end', message: { role: 'assistant', content: 'second pass' } }
      ]
    })
    const result = reduceBatch(afterSecondAssistant, editTool('4', 'second.ts', 1))

    const assistantMessages = result.messages.filter((message) => message.role === 'assistant')
    expect(assistantMessages[0].changes).toBeUndefined()
    expect(assistantMessages[1].changes?.files.map((file) => file.path)).toEqual([
      'first.ts',
      'second.ts'
    ])
  })
})
