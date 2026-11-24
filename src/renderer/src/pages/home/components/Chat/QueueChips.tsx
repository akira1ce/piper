import { X } from 'lucide-react'
import type { JSX } from 'react'
import { chatActions, useChatStore } from '../../store/chat'

export function QueueChips(): JSX.Element | null {
  const queue = useChatStore((state) => state.queue)
  if (queue.steering.length + queue.followUp.length === 0) return null

  return (
    <div className="mx-auto mb-2 flex max-w-3xl flex-wrap items-center gap-1.5 px-4">
      {queue.steering.map((text, index) => (
        <span
          key={`s-${index}`}
          className="border-accent-sky/40 text-accent-sky max-w-64 truncate rounded-full border px-2 py-0.5 text-[11px]"
        >
          引导 · {text}
        </span>
      ))}
      {queue.followUp.map((text, index) => (
        <span
          key={`f-${index}`}
          className="border-accent-violet/40 text-accent-violet max-w-64 truncate rounded-full border px-2 py-0.5 text-[11px]"
        >
          追问 · {text}
        </span>
      ))}
      <button
        type="button"
        onClick={() => void chatActions.clearQueue()}
        className="text-accent-neutral hover:text-fore flex items-center gap-0.5 text-[11px]"
      >
        <X className="size-3" />
        清空
      </button>
    </div>
  )
}
