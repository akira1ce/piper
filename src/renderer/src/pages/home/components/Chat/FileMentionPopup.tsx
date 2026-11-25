import { File as FileIcon } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { JSX } from 'react'
import { cn } from '@renderer/lib/utils'

interface FileMentionPopupProps {
  items: string[]
  activeIndex: number
  onPick: (path: string) => void
  onHover: (index: number) => void
  loading: boolean
  /** 视口坐标；placement 为 above 时以 top 作为下边缘 */
  position: { top: number; left: number; maxHeight: number; placement: 'above' | 'below' }
}

export function FileMentionPopup({
  items,
  activeIndex,
  onPick,
  onHover,
  loading,
  position
}: FileMentionPopupProps): JSX.Element {
  const activeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  return (
    <div
      className="bg-card border-accent-neutral/25 fixed z-50 w-80 overflow-y-auto rounded-lg border p-1 shadow-lg"
      style={{
        top: position.top,
        left: position.left,
        maxHeight: position.maxHeight,
        transform: position.placement === 'above' ? 'translateY(-100%)' : undefined
      }}
    >
      {loading && items.length === 0 ? (
        <p className="text-accent-neutral px-2 py-2 text-[11px]">读取文件列表…</p>
      ) : items.length === 0 ? (
        <p className="text-accent-neutral px-2 py-2 text-[11px]">无匹配文件</p>
      ) : (
        items.map((path, index) => {
          const filename = path.slice(path.lastIndexOf('/') + 1)
          const dir = path.slice(0, Math.max(0, path.lastIndexOf('/')))
          return (
            <button
              key={path}
              ref={index === activeIndex ? activeRef : undefined}
              type="button"
              onMouseEnter={() => onHover(index)}
              onMouseDown={(event) => {
                event.preventDefault()
                onPick(path)
              }}
              className={cn(
                'flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[11px]',
                index === activeIndex
                  ? 'bg-card-hover text-fore'
                  : 'text-accent-neutral hover:text-fore'
              )}
            >
              <FileIcon className="size-3 shrink-0" />
              <span className="min-w-0 flex-1 truncate">
                {dir && <span className="text-accent-neutral/70">{dir}/</span>}
                <span className="text-fore">{filename}</span>
              </span>
            </button>
          )
        })
      )}
    </div>
  )
}
