import { ArrowUp, PanelLeft, PanelRight } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { uiActions, useUiStore } from '../../store/ui'

export function Chat(): React.JSX.Element {
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed)
  const diffVisible = useUiStore((state) => state.diffVisible)

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
        <span className="text-accent-neutral ml-1 text-xs">新会话</span>
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

      <section className="flex min-h-0 flex-1 items-center justify-center">
        <div className="text-center">
          <p className="text-lg">今天想做点什么？</p>
          <p className="text-accent-neutral mt-2 text-xs">会话流还没接上 pi，先把界面骨架立起来</p>
        </div>
      </section>

      <footer className="shrink-0 px-4 pb-4">
        <div className="bg-card focus-within:border-accent-neutral/50 flex flex-col gap-2 rounded-xl border border-accent-neutral/25 p-2">
          <textarea
            rows={2}
            placeholder="给 pi 发消息…"
            className="placeholder:text-accent-neutral/70 w-full resize-none bg-transparent px-2 py-1 text-sm outline-none"
          />
          <div className="flex items-center justify-between px-1">
            <span className="text-accent-neutral text-[11px]">Enter 发送 · Shift+Enter 换行</span>
            <Button size="icon-sm" aria-label="发送">
              <ArrowUp />
            </Button>
          </div>
        </div>
      </footer>
    </div>
  )
}
