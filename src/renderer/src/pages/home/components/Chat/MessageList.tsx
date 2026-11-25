import { useVirtualizer } from '@tanstack/react-virtual'
import { ArrowDown } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { buildTurns } from '../../controller/turns'
import { useStickToBottom } from '../../controller/useStickToBottom'
import { useChatStore } from '../../store/chat'
import { MessageItem } from './MessageItem'
import { TurnRail } from './TurnRail'

/** 首屏/跳转时用于估算的高度，真实的会被 ResizeObserver 覆盖 */
const ESTIMATED_HEIGHT = 120
const OVERSCAN = 4

export function MessageList(): React.JSX.Element {
  const messages = useChatStore((state) => state.messages)
  const toolCalls = useChatStore((state) => state.toolCalls)
  const lastBlocks =
    messages
      .at(-1)
      ?.blocks.map((block) => block.text?.length ?? 0)
      .join(',') ?? ''
  const { containerRef, atBottom, scrollToBottom } = useStickToBottom(
    `${messages.length}:${lastBlocks}`
  )

  // TanStack Virtual 有意返回不可 memo 的函数，React Compiler 无法接管此组件
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => ESTIMATED_HEIGHT,
    overscan: OVERSCAN,
    getItemKey: (index) => messages[index]?.id ?? index
  })

  const turns = useMemo(() => buildTurns(messages), [messages])
  const virtualItems = virtualizer.getVirtualItems()
  // 取真正可见的第一条，而不是含 overscan 的 virtualItems[0]，避免高亮偏早
  const visibleIndex =
    virtualizer.getVirtualItemForOffset(virtualizer.scrollOffset ?? 0)?.index ??
    virtualItems[0]?.index ??
    messages.length - 1

  // 贴底由 useStickToBottom 的 scrollHeight 驱动；这里只处理流式输出时
  // 最后一条消息高度持续增长的情况。
  useEffect(() => {
    if (atBottom) virtualizer.scrollToIndex(messages.length - 1, { align: 'end' })
  }, [virtualizer, messages.length, lastBlocks, atBottom])

  return (
    <div className="relative min-h-0 flex-1">
      {messages.length > 0 && (
        <TurnRail
          turns={turns}
          visibleIndex={visibleIndex}
          onJump={(index) => virtualizer.scrollToIndex(index, { align: 'start' })}
        />
      )}
      <div ref={containerRef} className="h-full overflow-y-auto px-10 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-accent-neutral text-xs">发一条消息，或从左侧打开会话</p>
          </div>
        ) : (
          <div
            className="relative mx-auto w-full max-w-3xl"
            style={{ height: virtualizer.getTotalSize() }}
          >
            {virtualItems.map((item) => {
              const message = messages[item.index]
              if (!message) return null
              return (
                <div
                  key={item.key}
                  ref={virtualizer.measureElement}
                  data-index={item.index}
                  className="absolute top-0 left-0 w-full pb-6"
                  style={{ transform: `translateY(${item.start}px)` }}
                >
                  <MessageItem message={message} toolCalls={toolCalls} />
                </div>
              )
            })}
          </div>
        )}
      </div>
      {!atBottom && messages.length > 0 && (
        <button
          type="button"
          onClick={() => scrollToBottom()}
          className="bg-card border-accent-neutral/30 text-fore hover:bg-card-hover absolute bottom-4 left-1/2 flex size-8 -translate-x-1/2 items-center justify-center rounded-full border shadow"
          aria-label="回到底部"
        >
          <ArrowDown className="size-4" />
        </button>
      )}
    </div>
  )
}
