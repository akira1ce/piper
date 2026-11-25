import { ChevronRight, Folder, Plus } from 'lucide-react'
import type { JSX } from 'react'
import type { Project, SessionSummary } from '@shared/piProtocol'
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@renderer/components/ui/accordion'
import { SessionRow } from './SessionRow'

interface ProjectGroupProps {
  project: Project
  sessions: SessionSummary[]
  activeSessionPath: string | null
  onNewSession: () => void
  onOpenSession: (session: SessionSummary) => void
}

export function ProjectGroup({
  project,
  sessions,
  activeSessionPath,
  onNewSession,
  onOpenSession
}: ProjectGroupProps): JSX.Element {
  return (
    <AccordionItem value={project.id} className="border-0">
      <div className="group/project relative">
        <AccordionTrigger className="text-fore/80 items-center gap-1 py-1.5 pr-8 pl-1 text-xs hover:no-underline [&>svg]:hidden [&[data-state=open]_.chevron]:rotate-90">
          <span className="flex min-w-0 flex-1 items-center gap-1">
            <span className="chevron flex shrink-0 transition-transform">
              <ChevronRight className="size-3" />
            </span>
            <Folder className="text-accent-neutral size-3 shrink-0" />
            <span className="truncate">{project.name}</span>
            {!project.available && (
              <span className="text-accent-rose shrink-0 text-[10px]">目录失效</span>
            )}
          </span>
        </AccordionTrigger>
        <button
          type="button"
          aria-label="新建会话"
          onClick={onNewSession}
          disabled={!project.available}
          className="text-accent-neutral hover:text-fore absolute top-1/2 right-1 -translate-y-1/2 opacity-0 group-hover/project:opacity-100 disabled:opacity-30"
        >
          <Plus className="size-3.5" />
        </button>
      </div>
      <AccordionContent className="pt-0 pb-0">
        <div className="border-accent-neutral/20 mt-1 ml-3 space-y-0.5 border-l pl-2">
          {sessions.length === 0 && (
            <p className="text-accent-neutral px-2 py-1 text-[11px]">暂无会话</p>
          )}
          {sessions.map((session) => (
            <SessionRow
              key={session.path}
              projectId={project.id}
              session={session}
              active={session.path === activeSessionPath}
              onOpen={() => onOpenSession(session)}
            />
          ))}
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}
