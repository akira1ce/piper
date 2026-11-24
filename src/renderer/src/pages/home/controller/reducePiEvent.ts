import type {
  DomainEvent,
  ExtensionUiRequest,
  ModelInfo,
  MessageBlock,
  MessageView,
  PiBatch,
  SessionStats,
  ThinkingLevel,
  ToolCallView
} from '@shared/piProtocol'
import { messageToView, toText } from './messagesToView'

export interface ChatView {
  status: 'idle' | 'running' | 'compacting' | 'reconnecting' | 'error'
  lastSeq: number
  sessionPath: string | null
  thinkingLevel: ThinkingLevel
  messages: MessageView[]
  toolCalls: Record<string, ToolCallView>
  queue: { steering: string[]; followUp: string[] }
  banner: { kind: 'error' | 'info'; text: string } | null
  retryAttempt: number | null
  stats: SessionStats | null
  model: ModelInfo | null
  modelList: ModelInfo[]
  thinkingLevels: ThinkingLevel[]
  dialogs: ExtensionUiRequest[]
  extensionStatus: string | null
}

export function initialChatView(): ChatView {
  return {
    status: 'idle',
    lastSeq: 0,
    sessionPath: null,
    thinkingLevel: 'off',
    messages: [],
    toolCalls: {},
    queue: { steering: [], followUp: [] },
    banner: null,
    retryAttempt: null,
    stats: null,
    model: null,
    modelList: [],
    thinkingLevels: [],
    dialogs: [],
    extensionStatus: null
  }
}

export function reduceBatch(view: ChatView, batch: PiBatch): ChatView {
  if (batch.seq <= view.lastSeq) return view
  const next: ChatView = {
    ...view,
    lastSeq: batch.seq,
    messages: view.messages.map((message) => ({
      ...message,
      blocks: message.blocks.map((block) => ({ ...block }))
    })),
    toolCalls: { ...view.toolCalls },
    dialogs: [...view.dialogs]
  }
  for (const event of batch.events) applyEvent(next, event)
  return next
}

function applyEvent(view: ChatView, event: DomainEvent): void {
  switch (event.type) {
    case 'agent_start':
    case 'turn_start':
      view.status = 'running'
      return
    case 'agent_end':
      view.status = event.willRetry ? 'running' : view.status
      return
    case 'settled':
      view.status = 'idle'
      view.retryAttempt = null
      for (const [id, tool] of Object.entries(view.toolCalls)) {
        if (tool.state === 'running' || tool.state === 'pending') {
          view.toolCalls[id] = { ...tool, state: 'done' }
        }
      }
      return
    case 'message_start': {
      const message = messageToView(event.message, view.messages.length, view.toolCalls)
      if (message) view.messages.push(message)
      return
    }
    case 'message_end': {
      const message = messageToView(event.message, view.messages.length, view.toolCalls)
      if (!message) return
      const last = lastByRole(view, message.role)
      if (last) {
        last.blocks = message.blocks
      } else {
        view.messages.push({ ...message, id: `m_${view.messages.length}` })
      }
      return
    }
    case 'delta':
      applyDelta(view, event)
      return
    case 'block_end':
      applyBlockEnd(view, event)
      return
    case 'tool_start':
      view.toolCalls[event.toolCallId] = {
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        args: event.args,
        state: 'running',
        preview: ''
      }
      return
    case 'tool_update': {
      const tool = view.toolCalls[event.toolCallId]
      if (tool) {
        view.toolCalls[event.toolCallId] = {
          ...tool,
          preview: toText(event.partialResult).slice(0, 400)
        }
      }
      return
    }
    case 'tool_end': {
      const done = view.toolCalls[event.toolCallId]
      if (done) {
        view.toolCalls[event.toolCallId] = {
          ...done,
          state: event.isError ? 'error' : 'done',
          durationMs: event.durationMs,
          preview: toText(event.result).slice(0, 400)
        }
      }
      return
    }
    case 'queue':
      view.queue = { steering: event.steering, followUp: event.followUp }
      return
    case 'thinking_changed':
      view.thinkingLevel = event.level
      return
    case 'compaction':
      view.status = event.phase === 'start' ? 'compacting' : 'running'
      return
    case 'retry':
      view.retryAttempt = event.phase === 'start' ? (event.attempt ?? 1) : null
      view.banner =
        event.phase === 'start'
          ? { kind: 'info', text: `重试中（第 ${event.attempt ?? 1} 次）` }
          : event.success
            ? null
            : { kind: 'error', text: event.message ?? '重试失败' }
      return
    case 'protocol_error':
      view.banner = { kind: 'error', text: event.message }
      return
    case 'process_exit':
      view.status = 'error'
      view.banner = {
        kind: 'error',
        text: `pi 已退出：${event.stderrTail || event.code || event.signal}`
      }
      return
    case 'extension_ui': {
      const request = event.request
      if (request.method === 'setStatus') {
        view.extensionStatus = request.statusText ?? null
        return
      }
      if (
        request.method === 'select' ||
        request.method === 'confirm' ||
        request.method === 'input' ||
        request.method === 'editor'
      ) {
        if (!view.dialogs.some((dialog) => dialog.id === request.id)) {
          view.dialogs.push(request)
        }
      }
      return
    }
    case 'extension_error':
      view.banner = { kind: 'error', text: event.message }
      return
    default:
      return
  }
}

function applyDelta(view: ChatView, event: Extract<DomainEvent, { type: 'delta' }>): void {
  const message = lastAssistant(view)
  if (!message) return
  const block = ensureBlock(message, event.contentIndex, event.kind)
  if (event.kind === 'toolcall') {
    block.toolCallId = event.toolCallId ?? block.toolCallId
    return
  }
  block.text = `${block.text ?? ''}${event.text ?? ''}`
  block.streaming = true
}

function applyBlockEnd(view: ChatView, event: Extract<DomainEvent, { type: 'block_end' }>): void {
  const message = lastAssistant(view)
  if (!message) return
  const block = ensureBlock(message, event.contentIndex, event.kind)
  block.text = event.content
  block.streaming = false
}

function ensureBlock(
  message: MessageView,
  index: number,
  kind: MessageBlock['kind'] | 'toolcall'
): MessageBlock {
  for (let i = message.blocks.length; i <= index; i += 1) {
    message.blocks.push({ kind: kind === 'toolcall' ? 'tool' : kind, text: '', streaming: true })
  }
  const block = message.blocks[index]
  if (kind === 'toolcall') block.kind = 'tool'
  return block
}

function lastAssistant(view: ChatView): MessageView | undefined {
  return lastByRole(view, 'assistant')
}

function lastByRole(view: ChatView, role: MessageView['role']): MessageView | undefined {
  for (let i = view.messages.length - 1; i >= 0; i -= 1) {
    if (view.messages[i].role === role) return view.messages[i]
  }
  return undefined
}
