import { describe, expect, it } from 'vitest'
import { messagesToView } from './messagesToView'

describe('messagesToView turn change summaries', () => {
  it('puts historical tool changes on the last assistant message of the turn', () => {
    const result = messagesToView([
      { role: 'user', content: 'make changes' },
      {
        role: 'assistant',
        content: [{ type: 'toolCall', id: 'call_1', name: 'edit', arguments: { path: 'one.ts' } }]
      },
      {
        role: 'toolResult',
        toolCallId: 'call_1',
        details: {
          patch: '--- a/one.ts\n+++ b/one.ts\n@@ -1 +1 @@\n-old\n+new'
        }
      },
      { role: 'assistant', content: 'and then finished' }
    ])

    expect(result.messages[1].changes).toBeUndefined()
    expect(result.messages[2].changes?.files.map((file) => file.path)).toEqual(['one.ts'])
  })
})
