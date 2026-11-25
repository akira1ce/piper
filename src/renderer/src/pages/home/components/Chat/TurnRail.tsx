import { useEffect, useRef, useState } from 'react'
import type { JSX } from 'react'
import { cn } from '@renderer/lib/utils'
import type { Turn } from '../../controller/turns'

interface TurnRailProps {
  turns: Turn[]
  /** 当前视口顶部所在的消息下标，用来高亮对应的轮次 */
  visibleIndex: number
  onJump: (index: number) => void
}

const ROW_MAX = 22
const PADDING = 12

export function TurnRail({ turns, visibleIndex, onJump }: TurnRailProps): JSX.Element {
  const railRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(0)
  const [hovered, setHovered] = useState<number | null>(null)

  useEffect(() => {
    const element = railRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      setHeight(entry.contentRect.height)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  if (turns.length === 0) return <></>

  const available = Math.max(0, height - PADDING * 2)
  // 行高严格按可用空间均分，轮次再多也不会溢出容器
  const rowHeight = Math.min(ROW_MAX, available / turns.length)
  const dotSize = Math.min(6, Math.max(2, rowHeight - 4))
  const stackHeight = rowHeight * turns.length
  const offset = Math.max(0, (height - stackHeight) / 2)

  let active = 0
  for (let index = 0; index < turns.length; index += 1) {
    if (turns[index].index <= visibleIndex) active = index
    else break
  }

  const hoveredTurn = hovered !== null ? turns[hovered] : null

  return (
    <div
      ref={railRef}
      className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8"
      onMouseLeave={() => setHovered(null)}
    >
      <div className="pointer-events-auto absolute inset-x-0" style={{ top: offset }}>
        {turns.map((turn, index) => {
          const emphasized = index === active
          const faded = !emphasized && Math.abs(index - active) > 6
          return (
            <button
              key={turn.index}
              type="button"
              aria-label={`跳到第 ${index + 1} 轮`}
              onMouseEnter={() => setHovered(index)}
              onClick={() => onJump(turn.index)}
              className="flex w-8 items-center justify-center"
              style={{ height: rowHeight }}
            >
              <span
                className={cn(
                  'rounded-full transition-colors',
                  emphasized ? 'bg-brand opacity-100' : 'bg-accent-neutral',
                  !emphasized && (faded ? 'opacity-20' : 'opacity-45')
                )}
                style={{ width: dotSize, height: dotSize }}
              />
            </button>
          )
        })}
      </div>

      {hoveredTurn && hovered !== null && (
        <div
          className="bg-card border-accent-neutral/25 text-fore pointer-events-none absolute left-9 z-20 flex max-w-80 items-center gap-1 rounded border px-2 py-1 text-[11px] shadow-lg"
          style={{
            top: offset + hovered * rowHeight + rowHeight / 2,
            transform: 'translateY(-50%)'
          }}
        >
          <span className="text-accent-neutral shrink-0">第 {hovered + 1} 轮</span>
          <span className="min-w-0 truncate">{hoveredTurn.preview}</span>
        </div>
      )}
    </div>
  )
}
