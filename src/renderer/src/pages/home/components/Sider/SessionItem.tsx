import type { JSX } from 'react'
import type { SessionSummary } from '@shared/piProtocol'
import { cn } from '@renderer/lib/utils'

interface SessionItemProps {
  session: SessionSummary
  active: boolean
  onOpen: () => void
}

export function SessionItem({ session, active, onOpen }: SessionItemProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'text-fore/80 hover:bg-card-hover w-full truncate rounded px-2 py-1.5 text-left text-xs',
        active && 'bg-card-hover text-fore'
      )}
      title={session.name ?? session.firstMessage}
    >
      {session.name || session.firstMessage || '未命名会话'}
    </button>
  )
}
