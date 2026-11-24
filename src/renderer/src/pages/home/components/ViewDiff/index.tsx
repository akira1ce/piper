import { FileDiff } from 'lucide-react'

export function ViewDiff(): React.JSX.Element {
  return (
    <div className="border-accent-neutral/20 flex h-full min-w-0 flex-col border-l">
      <header className="window-drag flex h-12 shrink-0 items-center gap-2 px-3">
        <FileDiff className="text-accent-neutral size-4" />
        <span className="text-sm">变更</span>
      </header>

      <div className="flex flex-1 items-center justify-center">
        <p className="text-accent-neutral text-xs">还没有文件变更</p>
      </div>
    </div>
  )
}
