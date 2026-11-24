import type { JSX } from 'react'
import type { MessageView, ToolCallView } from '@shared/piProtocol'
import { Markdown } from './Markdown'
import { ThinkingBlock } from './ThinkingBlock'
import { ToolCallCard } from './ToolCallCard'

interface MessageItemProps {
  message: MessageView
  toolCalls: Record<string, ToolCallView>
}

export function MessageItem({ message, toolCalls }: MessageItemProps): JSX.Element {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="bg-card text-fore max-w-[80%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap">
          {message.blocks.map((block) => block.text).join('')}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2 text-sm">
      {message.blocks.map((block, index) => {
        if (block.kind === 'text') {
          return <Markdown key={index} text={block.text ?? ''} streaming={block.streaming} />
        }
        if (block.kind === 'thinking') {
          return <ThinkingBlock key={index} text={block.text ?? ''} streaming={block.streaming} />
        }
        const tool = block.toolCallId ? toolCalls[block.toolCallId] : undefined
        return tool ? <ToolCallCard key={index} tool={tool} /> : null
      })}
    </div>
  )
}
