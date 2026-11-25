export const THINKING_LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const
export type ThinkingLevel = (typeof THINKING_LEVELS)[number]

export interface ModelInfo {
  provider: string
  id: string
  contextWindow: number
  reasoning: boolean
}

export interface SessionSummary {
  path: string
  id: string
  cwd: string
  name?: string
  modified: number
  messageCount: number
  firstMessage: string
}

export interface SessionStats {
  userMessages?: number
  assistantMessages?: number
  toolCalls?: number
  tokens?: {
    input: number
    output: number
    cacheRead: number
    cacheWrite: number
    total: number
  }
  cost?: number
  contextUsage?: { tokens: number | null; contextWindow: number; percent: number | null }
}

export interface Project {
  id: string
  path: string
  name: string
  addedAt: number
  available: boolean
}

export interface ToolCallView {
  toolCallId: string
  toolName: string
  args: unknown
  state: 'pending' | 'running' | 'done' | 'error'
  preview: string
  durationMs?: number
}

export interface MessageBlock {
  kind: 'text' | 'thinking' | 'tool'
  text?: string
  streaming?: boolean
  toolCallId?: string
}

export interface FileChange {
  path: string
  status: 'modified' | 'created'
  additions: number
  deletions: number
  patch: string
}

export interface TurnChanges {
  files: FileChange[]
  additions: number
  deletions: number
}

export interface MessageView {
  id: string
  role: 'user' | 'assistant'
  blocks: MessageBlock[]
  changes?: TurnChanges
}

export interface ExtensionUiRequest {
  id: string
  method: 'select' | 'confirm' | 'input' | 'editor' | 'notify' | 'setStatus' | 'setTitle'
  title?: string
  message?: string
  options?: string[]
  prefill?: string
  timeout?: number
  notifyType?: 'info' | 'warning' | 'error'
  statusKey?: string
  statusText?: string
}

export type DomainEvent =
  | { type: 'agent_start' }
  | { type: 'turn_start' }
  | { type: 'agent_end'; willRetry: boolean }
  | { type: 'settled'; aborted: boolean }
  | { type: 'message_start'; message: unknown }
  | { type: 'message_end'; message: unknown }
  | {
      type: 'delta'
      kind: 'text' | 'thinking' | 'toolcall'
      contentIndex: number
      text?: string
      toolCallId?: string
      toolName?: string
    }
  | {
      type: 'block_end'
      kind: 'text' | 'thinking' | 'toolcall'
      contentIndex: number
      content: string
      toolCall?: unknown
    }
  | { type: 'tool_start'; toolCallId: string; toolName: string; args: unknown }
  | { type: 'tool_update'; toolCallId: string; partialResult: unknown }
  | {
      type: 'tool_end'
      toolCallId: string
      toolName: string
      result: unknown
      isError: boolean
      durationMs?: number
    }
  | { type: 'queue'; steering: string[]; followUp: string[] }
  | { type: 'thinking_changed'; level: ThinkingLevel }
  | { type: 'session_info'; name?: string }
  | {
      type: 'compaction'
      phase: 'start' | 'end'
      reason?: string
      aborted?: boolean
      willRetry?: boolean
    }
  | {
      type: 'retry'
      phase: 'start' | 'end'
      attempt?: number
      success?: boolean
      message?: string
    }
  | { type: 'extension_ui'; request: ExtensionUiRequest }
  | { type: 'extension_error'; message: string }
  | { type: 'protocol_error'; message: string }
  | { type: 'process_exit'; code: number | null; signal: string | null; stderrTail: string }

export type PiCommand =
  | { type: 'start'; cwd: string; sessionPath?: string }
  | { type: 'stop' }
  | { type: 'prompt'; text: string; behavior?: 'steer' | 'followUp' }
  | { type: 'abort' }
  | { type: 'abortRetry' }
  | { type: 'clearQueue' }
  | { type: 'state' }
  | { type: 'messages' }
  | { type: 'models' }
  | { type: 'setModel'; provider: string; modelId: string }
  | { type: 'thinkingLevels' }
  | { type: 'setThinkingLevel'; level: ThinkingLevel }
  | { type: 'stats' }
  | { type: 'newSession' }
  | { type: 'switchSession'; sessionPath: string }
  | { type: 'renameSession'; name: string }
  | { type: 'sessions'; projectId: string }
  | { type: 'projects' }
  | { type: 'addProject' }
  | { type: 'removeProject'; projectId: string }
  | { type: 'renameProject'; projectId: string; name: string }
  | { type: 'pickDirectory' }
  | { type: 'deleteSession'; sessionPath: string }
  | { type: 'setTheme'; theme: 'light' | 'dark' }
  | { type: 'files'; cwd: string }
  | { type: 'lastSession' }
  | { type: 'rememberSession'; projectId: string; sessionPath: string }
  | {
      type: 'extensionRespond'
      id: string
      value?: string
      confirmed?: boolean
      cancelled?: boolean
    }

export type PiResult<T = unknown> = { ok: true; data: T } | { ok: false; error: string }

export interface PiBatch {
  seq: number
  events: DomainEvent[]
}

export interface PiBridge {
  invoke(command: PiCommand): Promise<PiResult>
  onEvent(listener: (batch: PiBatch) => void): () => void
}
