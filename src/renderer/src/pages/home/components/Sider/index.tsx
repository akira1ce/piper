import { MessageSquarePlus, Settings } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'

export function Sider(): React.JSX.Element {
  return (
    <div className="bg-card flex h-full flex-col">
      <div className="window-drag flex h-12 shrink-0 items-center gap-2 pr-2 pl-[var(--titlebar-inset)]">
        <span className="text-sm font-medium">Piper</span>
      </div>

      <div className="px-2">
        <Button variant="ghost" className="window-no-drag w-full justify-start gap-2">
          <MessageSquarePlus />
          新建会话
        </Button>
      </div>

      <div className="mt-2 flex-1 overflow-y-auto px-2">
        <p className="text-accent-neutral px-2 py-1 text-xs">暂无会话</p>
      </div>

      <div className="border-accent-neutral/20 border-t p-2">
        <Button
          variant="ghost"
          size="sm"
          className="text-accent-neutral w-full justify-start gap-2"
        >
          <Settings />
          设置
        </Button>
      </div>
    </div>
  )
}
