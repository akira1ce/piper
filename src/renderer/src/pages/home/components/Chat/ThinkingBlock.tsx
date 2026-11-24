import { Brain, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@renderer/lib/utils'

interface ThinkingBlockProps {
  text: string
  streaming?: boolean
}

export function ThinkingBlock({ text, streaming }: ThinkingBlockProps): React.JSX.Element {
  const [open, setOpen] = useState(Boolean(streaming))

  return (
    <div className="border-accent-neutral/20 rounded-lg border">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="text-accent-neutral hover:text-fore flex w-full items-center gap-2 px-3 py-2 text-left text-xs"
      >
        <ChevronRight className={cn('size-3 transition-transform', open && 'rotate-90')} />
        <Brain className="size-3" />
        <span>{streaming ? '思考中…' : '思考过程'}</span>
      </button>
      {open && (
        <pre className="text-accent-neutral max-h-72 overflow-y-auto px-3 pb-3 font-mono text-[11px] whitespace-pre-wrap">
          {text}
        </pre>
      )}
    </div>
  )
}
