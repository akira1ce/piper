import { describe, expect, it } from 'vitest'
import { messagesToView } from './messagesToView'

describe('messagesToView', () => {
  it('maps user text and assistant text/thinking/toolCall blocks', () => {
    const { messages, toolCalls } = messagesToView([
      { role: 'user', content: '你好', timestamp: 1 },
      {
        role: 'assistant',
        content: [
          { type: 'thinking', thinking: '先看目录' },
          { type: 'text', text: '好的' },
          { type: 'toolCall', id: 'c1', name: 'bash', arguments: { command: 'ls' } }
        ],
        timestamp: 2
      }
    ])

    expect(messages).toHaveLength(2)
    expect(messages[0]).toMatchObject({ role: 'user', blocks: [{ kind: 'text', text: '你好' }] })
    expect(messages[1].blocks.map((block) => block.kind)).toEqual(['thinking', 'text', 'tool'])
    expect(messages[1].blocks[2].toolCallId).toBe('c1')
    expect(toolCalls.c1).toMatchObject({
      toolName: 'bash',
      args: { command: 'ls' },
      state: 'done'
    })
  })

  it('attaches tool results to the matching tool block', () => {
    const { messages, toolCalls } = messagesToView([
      {
        role: 'assistant',
        content: [{ type: 'toolCall', id: 'c1', name: 'bash', arguments: { command: 'ls' } }],
        timestamp: 1
      },
      {
        role: 'toolResult',
        toolCallId: 'c1',
        toolName: 'bash',
        content: [{ type: 'text', text: 'file-a\nfile-b' }],
        isError: false,
        timestamp: 2
      }
    ])

    expect(messages).toHaveLength(1)
    expect(toolCalls.c1).toMatchObject({ state: 'done', preview: 'file-a\nfile-b' })
  })

  it('marks errored tool results', () => {
    const { toolCalls } = messagesToView([
      {
        role: 'assistant',
        content: [{ type: 'toolCall', id: 'c1', name: 'bash', arguments: {} }],
        timestamp: 1
      },
      {
        role: 'toolResult',
        toolCallId: 'c1',
        toolName: 'bash',
        content: [{ type: 'text', text: 'boom' }],
        isError: true,
        timestamp: 2
      }
    ])
    expect(toolCalls.c1.state).toBe('error')
  })

  it('rebuilds turn changes from edit tool results', () => {
    const patch = '--- a/src/a.ts\n+++ b/src/a.ts\n@@ -1 +1 @@\n-old\n+new'
    const { messages } = messagesToView(
      [
        {
          role: 'assistant',
          content: [{ type: 'toolCall', id: 'c1', name: 'edit', arguments: { path: 'src/a.ts' } }],
          timestamp: 1
        },
        {
          role: 'toolResult',
          toolCallId: 'c1',
          toolName: 'edit',
          content: [{ type: 'text', text: 'ok' }],
          details: { patch },
          isError: false,
          timestamp: 2
        }
      ],
      { cwd: '/repo' }
    )
    expect(messages[0].changes).toMatchObject({
      additions: 1,
      deletions: 1,
      files: [{ path: 'src/a.ts' }]
    })
  })

  it('rebuilds created files from write tool calls', () => {
    const { messages } = messagesToView(
      [
        {
          role: 'assistant',
          content: [
            { type: 'toolCall', id: 'c1', name: 'write', arguments: { path: '/repo/new.md', content: 'a\nb' } }
          ],
          timestamp: 1
        },
        {
          role: 'toolResult',
          toolCallId: 'c1',
          toolName: 'write',
          content: [{ type: 'text', text: 'ok' }],
          isError: false,
          timestamp: 2
        }
      ],
      { cwd: '/repo' }
    )
    expect(messages[0].changes?.files[0]).toMatchObject({ path: 'new.md', status: 'created' })
  })

  it('skips system messages and renders image placeholders', () => {
    const { messages } = messagesToView([
      { role: 'system', content: 'prompt', timestamp: 1 },
      {
        role: 'user',
        content: [
          { type: 'text', text: '看图' },
          { type: 'image', data: 'xx', mimeType: 'image/png' }
        ],
        timestamp: 2
      }
    ])
    expect(messages).toHaveLength(1)
    expect(messages[0].blocks.map((block) => block.text)).toEqual(['看图', '[图片]'])
  })
})
