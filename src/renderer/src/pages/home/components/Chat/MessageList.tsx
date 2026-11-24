import { ArrowDown } from 'lucide-react'
import { useStickToBottom } from '../../controller/useStickToBottom'
import { useChatStore } from '../../store/chat'
import { MessageItem } from './MessageItem'

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

  return (
    <div className="relative min-h-0 flex-1">
      <div ref={containerRef} className="h-full overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-accent-neutral text-xs">发一条消息，或从左侧打开会话</p>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-6">
            {messages.map((message) => (
              <MessageItem key={message.id} message={message} toolCalls={toolCalls} />
            ))}
          </div>
        )}
      </div>
      {!atBottom && messages.length > 0 && (
        <button
          type="button"
          onClick={scrollToBottom}
          className="bg-card border-accent-neutral/30 text-fore hover:bg-card-hover absolute bottom-4 left-1/2 flex size-8 -translate-x-1/2 items-center justify-center rounded-full border shadow"
          aria-label="回到底部"
        >
          <ArrowDown className="size-4" />
        </button>
      )}
    </div>
  )
}
