import { AlertCircle, Check, Loader2, Wrench } from 'lucide-react'
import type { JSX } from 'react'
import type { ToolCallView } from '@shared/piProtocol'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@renderer/components/ui/accordion'

interface ToolCallCardProps {
  tool: ToolCallView
}

export function ToolCallCard({ tool }: ToolCallCardProps): JSX.Element {
  const statusIcon =
    tool.state === 'running' || tool.state === 'pending' ? (
      <Loader2 className="text-accent-sky size-3 shrink-0 animate-spin" />
    ) : tool.state === 'error' ? (
      <AlertCircle className="text-accent-rose size-3 shrink-0" />
    ) : (
      <Check className="text-accent-emerald size-3 shrink-0" />
    )

  return (
    <Accordion
      type="single"
      collapsible
      className="border-accent-neutral/20 bg-card/40 rounded-lg border"
    >
      <AccordionItem value="tool" className="border-0">
        <AccordionTrigger className="items-center gap-2 px-3 py-2 text-[11px] hover:no-underline [&>svg]:translate-y-0">
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <Wrench className="text-accent-neutral size-3 shrink-0" />
            <span className="font-mono">{tool.toolName}</span>
            {statusIcon}
            {tool.durationMs !== undefined && (
              <span className="text-accent-neutral ml-auto text-[10px]">{tool.durationMs}ms</span>
            )}
          </span>
        </AccordionTrigger>
        <AccordionContent className="px-3 pb-3">
          <div className="space-y-2">
            <pre className="text-accent-neutral bg-main/60 max-h-72 overflow-auto rounded p-2 font-mono text-[11px] whitespace-pre-wrap">
              {summarizeArgs(tool.args)}
            </pre>
            {tool.preview && (
              <pre className="text-fore/80 bg-main/60 max-h-72 overflow-auto rounded p-2 font-mono text-[11px] whitespace-pre-wrap">
                {tool.preview}
              </pre>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}

function summarizeArgs(args: unknown): string {
  if (!args || typeof args !== 'object') return String(args ?? '')
  return JSON.stringify(args, null, 2)
}
