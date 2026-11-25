import { useCallback, useEffect, useRef, useState } from 'react'
import type { JSX } from 'react'
import { cn } from '@renderer/lib/utils'
import type { Turn } from '../../controller/turns'

interface TurnRailProps {
  turns: Turn[]
  /** 当前视口顶部所在的消息下标，用来高亮对应的轮次 */
  visibleIndex: number
  onJump: (index: number) => void
}

/** 行高/点径恒定：轮次再多也不压缩，装不下时 rail 自身滚动（博客目录语义） */
const ROW_HEIGHT = 20
const DOT_SIZE = 6
/** 内容垂直内边距 */
const PADDING = 12
/** 悬浮浮层与视口上下边缘的最小留白 */
const VIEWPORT_MARGIN = 12
/** 距离激活轮次超过这个数量就淡化 */
const FADE_DISTANCE = 6

interface HoverState {
  index: number
  /** 浮层在视口中的纵坐标（已 clamp 到视口内） */
  top: number
  left: number
}

// TODO: 若将来出现上千轮的会话，再给 rail 内部套虚拟化；
// 当前轮次量级下 map 82~300 个 button 的协调成本可忽略，不做 memo/二分。
export function TurnRail({ turns, visibleIndex, onJump }: TurnRailProps): JSX.Element {
  const railRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(0)
  const [hover, setHover] = useState<HoverState | null>(null)

  useEffect(() => {
    const element = railRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      setHeight(entry.contentRect.height)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // turns[].index 天然升序，线性扫描即可（数百级轮次，纳秒量级）
  let active = 0
  for (let index = 0; index < turns.length; index += 1) {
    if (turns[index].index <= visibleIndex) active = index
    else break
  }

  const available = Math.max(0, height - PADDING * 2)
  const stackHeight = ROW_HEIGHT * turns.length
  const overflowing = stackHeight > available
  // 装得下：整体垂直居中；装不下：顶部对齐，交给自身滚动
  const paddingTop = overflowing ? PADDING : Math.max(PADDING, (height - stackHeight) / 2)
  const paddingBottom = overflowing ? PADDING : paddingTop

  const scrollToActive = useCallback(() => {
    const element = scrollRef.current
    if (!element || !overflowing) return
    // 让激活行垂直居中，上下各留出「附近还有几轮」的上下文
    const target = active * ROW_HEIGHT - element.clientHeight / 2 + ROW_HEIGHT / 2
    const max = Math.max(0, element.scrollHeight - element.clientHeight)
    element.scrollTop = Math.min(Math.max(target, 0), max)
  }, [active, overflowing])

  // 只在激活轮次变化时跟随；用户手动翻 rail 时 active 不变，因此不会被抢滚动
  useEffect(scrollToActive, [scrollToActive])

  const handleEnter = useCallback((index: number, element: HTMLElement) => {
    const rect = element.getBoundingClientRect()
    const top = Math.min(
      Math.max(rect.top + rect.height / 2, VIEWPORT_MARGIN),
      window.innerHeight - VIEWPORT_MARGIN
    )
    setHover({ index, top, left: rect.right + 4 })
  }, [])

  if (turns.length === 0) return <></>

  const hoveredTurn = hover ? turns[hover.index] : null

  return (
    <div ref={railRef} className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8">
      <div
        ref={scrollRef}
        onScroll={() => setHover(null)}
        className="pointer-events-auto absolute inset-0 overflow-x-hidden overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div style={{ paddingTop, paddingBottom }}>
          {turns.map((turn, index) => {
            const emphasized = index === active
            const faded = !emphasized && Math.abs(index - active) > FADE_DISTANCE
            return (
              <button
                key={turn.index}
                type="button"
                aria-label={`跳到第 ${index + 1} 轮`}
                onMouseEnter={(event) => handleEnter(index, event.currentTarget)}
                onClick={() => onJump(turn.index)}
                className="flex w-8 items-center justify-center"
                style={{ height: ROW_HEIGHT }}
              >
                <span
                  className={cn(
                    'rounded-full transition-colors',
                    emphasized ? 'bg-brand opacity-100' : 'bg-accent-neutral',
                    !emphasized && (faded ? 'opacity-20' : 'opacity-45')
                  )}
                  style={{ width: DOT_SIZE, height: DOT_SIZE }}
                />
              </button>
            )
          })}
        </div>
      </div>

      {/* 溢出时上下渐隐，提示还有更多轮次可滚 */}
      {overflowing && (
        <>
          <div className="from-main pointer-events-none absolute inset-x-0 top-0 h-3 bg-gradient-to-b to-transparent" />
          <div className="from-main pointer-events-none absolute inset-x-0 bottom-0 h-3 bg-gradient-to-t to-transparent" />
        </>
      )}

      {hover && hoveredTurn && (
        <div
          className="bg-card border-accent-neutral/25 text-fore pointer-events-none fixed z-20 flex max-w-80 items-center gap-1 rounded border px-2 py-1 text-[11px] shadow-lg"
          style={{ top: hover.top, left: hover.left, transform: 'translateY(-50%)' }}
        >
          <span className="text-accent-neutral shrink-0">第 {hover.index + 1} 轮</span>
          <span className="min-w-0 truncate">{hoveredTurn.preview}</span>
        </div>
      )}
    </div>
  )
}
