import { Brain } from 'lucide-react'
import type { JSX } from 'react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@renderer/components/ui/accordion'

interface ThinkingBlockProps {
  text: string
  streaming?: boolean
}

export function ThinkingBlock({ text, streaming }: ThinkingBlockProps): JSX.Element {
  return (
    <Accordion
      type="single"
      collapsible
      defaultValue={streaming ? 'thinking' : undefined}
      className="border-accent-neutral/20 rounded-lg border"
    >
      <AccordionItem value="thinking" className="border-0">
        <AccordionTrigger className="items-center gap-2 px-3 py-2 text-[11px] hover:no-underline [&>svg]:translate-y-0">
          <span className="text-accent-neutral flex min-w-0 flex-1 items-center gap-2">
            <Brain className="size-3 shrink-0" />
            {streaming ? '思考中…' : '思考过程'}
          </span>
        </AccordionTrigger>
        <AccordionContent className="px-3 pb-3">
          <pre className="text-accent-neutral max-h-72 overflow-y-auto font-mono text-[11px] whitespace-pre-wrap">
            {text}
          </pre>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
