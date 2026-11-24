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
