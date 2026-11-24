import type { JSX } from 'react'
import { useChatStore } from '../../store/chat'
import { formatContext, formatCost, formatTokens } from '../../util/formatStats'

export function StatsBar(): JSX.Element | null {
  const stats = useChatStore((state) => state.stats)
  if (!stats) return null

  const total = stats.tokens?.total ?? 0
  const context = stats.contextUsage ? formatContext(stats.contextUsage) : null

  return (
    <div
      className="text-accent-neutral flex items-center gap-1.5 text-[10px]"
      title={context ?? undefined}
    >
      <span>{formatTokens(total)} tokens</span>
      <span>·</span>
      <span>{formatCost(stats.cost ?? 0)}</span>
      {context && (
        <>
          <span>·</span>
          <span>{context}</span>
        </>
      )}
    </div>
  )
}
