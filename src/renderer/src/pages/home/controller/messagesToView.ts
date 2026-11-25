import type { MessageBlock, MessageView, ToolCallView } from '@shared/piProtocol'
import { fileChangeFromTool, mergeChanges, summarizeChanges } from './changes'

interface RawBlock {
  type?: string
  text?: string
  thinking?: string
  id?: string
  name?: string
  arguments?: unknown
}

interface RawMessage {
  role?: string
  content?: unknown
  toolCallId?: string
  toolName?: string
  isError?: boolean
  details?: { patch?: string }
}

interface ToolCallInfo {
  messageIndex: number
  toolName: string
  args: unknown
}

export interface MessagesToViewOptions {
  cwd?: string | null
}

export function messagesToView(
  raw: unknown[],
  options: MessagesToViewOptions = {}
): {
  messages: MessageView[]
  toolCalls: Record<string, ToolCallView>
} {
  const messages: MessageView[] = []
  const toolCalls: Record<string, ToolCallView> = {}
  const calls = new Map<string, ToolCallInfo>()

  for (const item of raw) {
    const message = item as RawMessage
    if (message.role === 'toolResult') {
      applyToolResult(toolCalls, message)
      applyChange(messages, calls.get(message.toolCallId ?? ''), message, options.cwd ?? null)
      continue
    }
    const view = messageToView(message, messages.length, toolCalls, calls)
    if (view) messages.push(view)
  }

  return { messages, toolCalls }
}

export function messageToView(
  raw: unknown,
  index = 0,
  toolCalls: Record<string, ToolCallView> = {},
  calls?: Map<string, ToolCallInfo>
): MessageView | null {
  const message = raw as RawMessage
  if (message.role !== 'user' && message.role !== 'assistant') return null
  return {
    id: `m_${index}`,
    role: message.role,
    blocks: toBlocks(message.content, toolCalls, index, calls)
  }
}

function toBlocks(
  content: unknown,
  toolCalls: Record<string, ToolCallView>,
  messageIndex: number,
  calls?: Map<string, ToolCallInfo>
): MessageBlock[] {
  if (typeof content === 'string') return [{ kind: 'text', text: content, streaming: false }]
  if (!Array.isArray(content)) return []

  const blocks: MessageBlock[] = []
  for (const item of content as RawBlock[]) {
    if (item.type === 'text') {
      blocks.push({ kind: 'text', text: item.text ?? '', streaming: false })
    } else if (item.type === 'thinking') {
      blocks.push({ kind: 'thinking', text: item.thinking ?? '', streaming: false })
    } else if (item.type === 'image') {
      blocks.push({ kind: 'text', text: '[图片]', streaming: false })
    } else if (item.type === 'toolCall' && item.id) {
      blocks.push({ kind: 'tool', toolCallId: item.id, text: '', streaming: false })
      calls?.set(item.id, {
        messageIndex,
        toolName: item.name ?? 'tool',
        args: item.arguments
      })
      // 历史会话默认已完成；流式过程中已有状态时保留不覆盖
      toolCalls[item.id] ??= {
        toolCallId: item.id,
        toolName: item.name ?? 'tool',
        args: item.arguments ?? {},
        state: 'done',
        preview: ''
      }
    }
  }
  return blocks
}

function applyChange(
  messages: MessageView[],
  call: ToolCallInfo | undefined,
  message: RawMessage,
  cwd: string | null
): void {
  if (!call) return
  const target = messages[call.messageIndex]
  if (!target) return
  const change = fileChangeFromTool({
    toolName: call.toolName,
    args: call.args,
    result: { details: message.details },
    cwd
  })
  if (!change) return
  target.changes = summarizeChanges(mergeChanges(target.changes?.files ?? [], change))
}

function applyToolResult(toolCalls: Record<string, ToolCallView>, message: RawMessage): void {
  const id = message.toolCallId
  if (!id) return
  const preview = toText(message.content).slice(0, 2000)
  toolCalls[id] = {
    toolCallId: id,
    toolName: message.toolName ?? toolCalls[id]?.toolName ?? 'tool',
    args: toolCalls[id]?.args ?? {},
    state: message.isError ? 'error' : 'done',
    preview
  }
}

export function toText(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map((block) => {
      const text = (block as { text?: unknown } | null)?.text
      return typeof text === 'string' ? text : ''
    })
    .filter(Boolean)
    .join('\n')
}
