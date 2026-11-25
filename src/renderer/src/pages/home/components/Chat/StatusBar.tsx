import type { JSX } from 'react'
import { chatActions, useChatStore } from '../../store/chat'
import { ModelPicker } from './ModelPicker'
import { StatsBar } from './StatsBar'
import { ThinkingPicker } from './ThinkingPicker'

export function StatusBar(): JSX.Element {
  const status = useChatStore((state) => state.status)
  const sessionId = useChatStore((state) => state.sessionId)
  const extensionStatus = useChatStore((state) => state.extensionStatus)
  const retryAttempt = useChatStore((state) => state.retryAttempt)

  const statusText =
    status === 'running'
      ? '运行中'
      : status === 'compacting'
        ? '压缩上下文中'
        : status === 'error'
          ? '连接异常'
          : status === 'reconnecting'
            ? '重连中'
            : '空闲'

  return (
    <div className="text-accent-neutral flex shrink-0 items-center justify-between gap-2 px-4 pt-1 pb-2 text-[10px]">
      <div className="flex min-w-0 items-center gap-2">
        <span className="shrink-0">{statusText}</span>
        {sessionId && (
          <span className="shrink-0 font-mono opacity-70" title={`session id: ${sessionId}`}>
            #{sessionId.slice(0, 8)}
          </span>
        )}
        {extensionStatus && <span className="min-w-0 truncate">{extensionStatus}</span>}
        {retryAttempt !== null && (
          <button
            type="button"
            onClick={() => void chatActions.abortRetry()}
            className="text-accent-sky hover:text-fore shrink-0 underline underline-offset-2"
          >
            中止重试（第 {retryAttempt} 次）
          </button>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <ModelPicker />
        <ThinkingPicker />
        <StatsBar />
      </div>
    </div>
  )
}
