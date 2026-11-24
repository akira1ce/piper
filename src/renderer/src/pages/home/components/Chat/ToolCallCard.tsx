import { AlertCircle, Check, ChevronRight, Loader2, Wrench } from 'lucide-react'
import { useState } from 'react'
import type { ToolCallView } from '@shared/piProtocol'
import { cn } from '@renderer/lib/utils'

interface ToolCallCardProps {
  tool: ToolCallView
}

export function ToolCallCard({ tool }: ToolCallCardProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const statusIcon =
    tool.state === 'running' || tool.state === 'pending' ? (
      <Loader2 className="text-accent-sky size-3 animate-spin" />
    ) : tool.state === 'error' ? (
      <AlertCircle className="text-accent-rose size-3" />
    ) : (
      <Check className="text-accent-emerald size-3" />
    )

  return (
    <div className="border-accent-neutral/20 bg-card/40 rounded-lg border">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs"
      >
        <ChevronRight className={cn('size-3 transition-transform', open && 'rotate-90')} />
        <Wrench className="text-accent-neutral size-3" />
        <span className="font-mono">{tool.toolName}</span>
        {statusIcon}
        {tool.durationMs !== undefined && (
          <span className="text-accent-neutral ml-auto text-[10px]">{tool.durationMs}ms</span>
        )}
      </button>
      {open && (
        <div className="space-y-2 px-3 pb-3">
          <pre className="text-accent-neutral bg-main/60 overflow-x-auto rounded p-2 font-mono text-[11px] whitespace-pre-wrap">
            {summarizeArgs(tool.args)}
          </pre>
          {tool.preview && (
            <pre className="text-fore/80 bg-main/60 max-h-64 overflow-auto rounded p-2 font-mono text-[11px] whitespace-pre-wrap">
              {tool.preview}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

function summarizeArgs(args: unknown): string {
  if (!args || typeof args !== 'object') return String(args ?? '')
  return JSON.stringify(args, null, 2)
}
