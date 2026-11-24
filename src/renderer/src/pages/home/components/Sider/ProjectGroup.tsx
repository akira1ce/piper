import { ChevronRight, Plus } from 'lucide-react'
import type { JSX } from 'react'
import type { Project, SessionSummary } from '@shared/piProtocol'
import { cn } from '@renderer/lib/utils'
import { SessionRow } from './SessionRow'

interface ProjectGroupProps {
  project: Project
  sessions: SessionSummary[]
  expanded: boolean
  activeSessionPath: string | null
  onToggle: () => void
  onNewSession: () => void
  onOpenSession: (session: SessionSummary) => void
}

export function ProjectGroup(props: ProjectGroupProps): JSX.Element {
  return (
    <div className="mb-1">
      <div className="hover:bg-card-hover group flex items-center rounded px-1">
        <button
          type="button"
          onClick={props.onToggle}
          className="text-fore/80 flex min-w-0 flex-1 items-center gap-1 py-1.5 text-left text-xs"
        >
          <ChevronRight
            className={cn('size-3 shrink-0 transition-transform', props.expanded && 'rotate-90')}
          />
          <span className="truncate">{props.project.name}</span>
          {!props.project.available && (
            <span className="text-accent-rose shrink-0 text-[10px]">目录失效</span>
          )}
        </button>
        <button
          type="button"
          aria-label="新建会话"
          onClick={props.onNewSession}
          disabled={!props.project.available}
          className="text-accent-neutral hover:text-fore opacity-0 group-hover:opacity-100 disabled:opacity-30"
        >
          <Plus className="size-3.5" />
        </button>
      </div>
      {props.expanded && (
        <div className="border-accent-neutral/20 mt-1 ml-3 space-y-0.5 border-l pl-2">
          {props.sessions.length === 0 && (
            <p className="text-accent-neutral px-2 py-1 text-[11px]">暂无会话</p>
          )}
          {props.sessions.map((session) => (
            <SessionRow
              key={session.path}
              projectId={props.project.id}
              session={session}
              active={session.path === props.activeSessionPath}
              onOpen={() => props.onOpenSession(session)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
