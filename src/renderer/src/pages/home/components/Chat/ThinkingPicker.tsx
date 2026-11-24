import { Brain, Check, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import type { JSX } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'
import { cn } from '@renderer/lib/utils'
import { chatActions, useChatStore } from '../../store/chat'

export function ThinkingPicker(): JSX.Element {
  const [open, setOpen] = useState(false)
  const level = useChatStore((state) => state.thinkingLevel)
  const levels = useChatStore((state) => state.thinkingLevels)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="text-accent-neutral hover:text-fore focus-visible:ring-ring/50 flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] outline-none focus-visible:ring-2"
          title="thinking 级别"
        >
          <Brain className="size-3" />
          <span>{level}</span>
          <ChevronDown className="size-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-40">
        {levels.length === 0 && (
          <p className="text-accent-neutral px-2 py-2 text-xs">当前模型不支持</p>
        )}
        {levels.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => {
              void chatActions.setThinkingLevel(item)
              setOpen(false)
            }}
            className={cn(
              'hover:bg-card-hover flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs',
              item === level ? 'text-fore' : 'text-accent-neutral'
            )}
          >
            <span>{item}</span>
            {item === level && <Check className="text-accent-emerald size-3" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}
