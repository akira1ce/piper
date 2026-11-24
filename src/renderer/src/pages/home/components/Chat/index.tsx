import { PanelLeft, PanelRight } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'
import { chatActions, useChatStore } from '../../store/chat'
import { Composer } from './Composer'
import { ExtensionDialog } from './ExtensionDialog'
import { ModelPicker } from './ModelPicker'
import { MessageList } from './MessageList'
import { QueueChips } from './QueueChips'
import { StatsBar } from './StatsBar'
import { ThinkingPicker } from './ThinkingPicker'
import { useProjectsStore } from '../../store/projects'
import { uiActions, useUiStore } from '../../store/ui'

export function Chat(): React.JSX.Element {
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed)
  const diffVisible = useUiStore((state) => state.diffVisible)
  const status = useChatStore((state) => state.status)
  const banner = useChatStore((state) => state.banner)
  const retryAttempt = useChatStore((state) => state.retryAttempt)
  const sessionPath = useChatStore((state) => state.sessionPath)
  const extensionStatus = useChatStore((state) => state.extensionStatus)
  const sessionId = useChatStore((state) => state.sessionId)
  const activeSessionPath = useProjectsStore((state) => state.activeSessionPath)
  const sessions = useProjectsStore((state) => state.sessions)
  const title = useMemo(() => {
    for (const list of Object.values(sessions)) {
      const found = list.find((session) => session.path === activeSessionPath)
      if (found) return found.name || found.firstMessage || '会话'
    }
    return '新会话'
  }, [sessions, activeSessionPath])

  useEffect(() => {
    if (status === 'idle' && sessionPath) void chatActions.loadStats()
  }, [status, sessionPath])

  useEffect(() => {
    if (sessionPath) void chatActions.loadMeta()
  }, [sessionPath])

  return (
    <div className="flex h-full min-w-0 flex-col">
      <header
        className={cn(
          'window-drag flex h-12 shrink-0 items-center gap-1 pr-2 transition-[padding] duration-150',
          sidebarCollapsed ? 'pl-[var(--titlebar-inset)]' : 'pl-2'
        )}
      >
        <Button
          variant="ghost"
          size="icon-sm"
          className="window-no-drag text-accent-neutral"
          aria-label={sidebarCollapsed ? '展开侧栏' : '收起侧栏'}
          onClick={uiActions.toggleSidebar}
        >
          <PanelLeft />
        </Button>
        <span className="text-accent-neutral ml-1 truncate text-xs">{title}</span>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="icon-sm"
          className="window-no-drag text-accent-neutral"
          aria-label={diffVisible ? '隐藏变更' : '显示变更'}
          onClick={uiActions.toggleDiff}
        >
          <PanelRight />
        </Button>
      </header>

      <div className="text-accent-neutral flex items-center justify-between gap-2 px-3 py-1 text-[11px]">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0">
            {status === 'running'
              ? '运行中'
              : status === 'compacting'
                ? '压缩上下文中'
                : status === 'error'
                  ? '连接异常'
                  : '空闲'}
          </span>
          {sessionId && (
            <span
              className="text-accent-neutral/70 shrink-0 font-mono text-[10px]"
              title={`session id: ${sessionId}`}
            >
              #{sessionId.slice(0, 8)}
            </span>
          )}
          {extensionStatus && (
            <span className="text-accent-neutral shrink-0 truncate">{extensionStatus}</span>
          )}
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
      {banner && (
        <div
          className={cn(
            'flex items-center justify-between gap-2 px-3 py-1 text-[11px]',
            banner.kind === 'error' ? 'text-accent-rose' : 'text-accent-sky'
          )}
        >
          <span className="min-w-0 truncate">{banner.text}</span>
          {status === 'error' && sessionPath && (
            <button
              type="button"
              onClick={() => void chatActions.reconnect()}
              className="text-accent-sky hover:text-fore shrink-0 underline underline-offset-2"
            >
              重连
            </button>
          )}
        </div>
      )}

      <MessageList />

      <QueueChips />

      <Composer />

      <ExtensionDialog />
    </div>
  )
}
