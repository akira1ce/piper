import type { DomainEvent, ExtensionUiRequest, ThinkingLevel } from '@shared/piProtocol'

type Record_ = Record<string, any>

export function mapRecord(record: Record_): DomainEvent[] {
  switch (record.type) {
    case 'agent_start':
      return [{ type: 'agent_start' }]
    case 'turn_start':
      return [{ type: 'turn_start' }]
    case 'agent_end':
      return [{ type: 'agent_end', willRetry: Boolean(record.willRetry) }]
    case 'agent_settled':
      return [{ type: 'settled', aborted: Boolean(record.aborted) }]
    case 'message_start':
      return [{ type: 'message_start', message: record.message }]
    case 'message_end':
      return [{ type: 'message_end', message: record.message }]
    case 'message_update':
      return mapUpdate(record.assistantMessageEvent)
    case 'tool_execution_start':
      return [
        {
          type: 'tool_start',
          toolCallId: record.toolCallId,
          toolName: record.toolName,
          args: record.args
        }
      ]
    case 'tool_execution_update':
      return [
        { type: 'tool_update', toolCallId: record.toolCallId, partialResult: record.partialResult }
      ]
    case 'tool_execution_end':
      return [
        {
          type: 'tool_end',
          toolCallId: record.toolCallId,
          result: record.result,
          isError: Boolean(record.isError),
          durationMs: record.durationMs
        }
      ]
    case 'queue_update':
      return [{ type: 'queue', steering: record.steering ?? [], followUp: record.followUp ?? [] }]
    case 'thinking_level_changed':
      return [{ type: 'thinking_changed', level: record.level as ThinkingLevel }]
    case 'session_info_changed':
      return [{ type: 'session_info', name: record.name ?? undefined }]
    case 'compaction_start':
      return [{ type: 'compaction', phase: 'start', reason: record.reason }]
    case 'compaction_end':
      return [
        {
          type: 'compaction',
          phase: 'end',
          reason: record.reason,
          aborted: Boolean(record.aborted),
          willRetry: Boolean(record.willRetry)
        }
      ]
    case 'auto_retry_start':
      return [
        { type: 'retry', phase: 'start', attempt: record.attempt, message: record.errorMessage }
      ]
    case 'auto_retry_end':
      return [
        {
          type: 'retry',
          phase: 'end',
          success: Boolean(record.success),
          message: record.finalError
        }
      ]
    case 'extension_ui_request':
      return [{ type: 'extension_ui', request: toExtensionUiRequest(record) }]
    case 'extension_error':
      return [{ type: 'extension_error', message: String(record.error ?? 'extension error') }]
    default:
      return []
  }
}

function mapUpdate(update: Record_ | undefined): DomainEvent[] {
  if (!update) return []
  switch (update.type) {
    case 'text_delta':
      return [
        { type: 'delta', kind: 'text', contentIndex: update.contentIndex, text: update.delta }
      ]
    case 'thinking_delta':
      return [
        { type: 'delta', kind: 'thinking', contentIndex: update.contentIndex, text: update.delta }
      ]
    case 'toolcall_start':
      return [
        {
          type: 'delta',
          kind: 'toolcall',
          contentIndex: update.contentIndex,
          toolCallId: update.id,
          toolName: update.toolName
        }
      ]
    case 'toolcall_delta':
      return [
        { type: 'delta', kind: 'toolcall', contentIndex: update.contentIndex, text: update.delta }
      ]
    case 'text_end':
    case 'thinking_end':
      return [
        {
          type: 'block_end',
          kind: update.type === 'text_end' ? 'text' : 'thinking',
          contentIndex: update.contentIndex,
          content: update.content
        }
      ]
    case 'toolcall_end':
      return [
        {
          type: 'block_end',
          kind: 'toolcall',
          contentIndex: update.contentIndex,
          content: '',
          toolCall: update.toolCall
        }
      ]
    default:
      return []
  }
}

function toExtensionUiRequest(record: Record_): ExtensionUiRequest {
  return {
    id: record.id,
    method: record.method,
    title: record.title,
    message: record.message,
    options: record.options,
    prefill: record.prefill,
    timeout: record.timeout,
    notifyType: record.notifyType
  }
}
