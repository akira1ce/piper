import { PanelLeft, PanelRight } from 'lucide-react'
import { useMemo } from 'react'
import { Button } from '@renderer/components/ui/button'
import { useChatStore } from '../../store/chat'
import { Composer } from './Composer'
import { MessageList } from './MessageList'
import { useProjectsStore } from '../../store/projects'
import { uiActions, useUiStore } from '../../store/ui'

export function Chat(): React.JSX.Element {
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed)
  const diffVisible = useUiStore((state) => state.diffVisible)
  const status = useChatStore((state) => state.status)
  const banner = useChatStore((state) => state.banner)
  const activeSessionPath = useProjectsStore((state) => state.activeSessionPath)
  const sessions = useProjectsStore((state) => state.sessions)
  const title = useMemo(() => {
    for (const list of Object.values(sessions)) {
      const found = list.find((session) => session.path === activeSessionPath)
      if (found) return found.name || found.firstMessage || '会话'
    }
    return '新会话'
  }, [sessions, activeSessionPath])

  return (
    <div className="flex h-full min-w-0 flex-col">
      <header className="window-drag flex h-12 shrink-0 items-center gap-1 px-2">
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

      <div className="text-accent-neutral px-3 py-1 text-[11px]">
        {status === 'running'
          ? '运行中'
          : status === 'compacting'
            ? '压缩上下文中'
            : status === 'error'
              ? '连接异常'
              : '空闲'}
      </div>
      {banner && <div className="text-accent-rose px-3 py-1 text-[11px]">{banner.text}</div>}

      <MessageList />

      <Composer />
    </div>
  )
}
