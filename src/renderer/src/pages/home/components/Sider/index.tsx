import { Plus, RefreshCw } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { projectActions, useProjectsStore } from '../../store/projects'
import { ProjectGroup } from './ProjectGroup'

export function Sider(): React.JSX.Element {
  const projects = useProjectsStore((state) => state.projects)
  const sessions = useProjectsStore((state) => state.sessions)
  const expanded = useProjectsStore((state) => state.expanded)
  const activeSessionPath = useProjectsStore((state) => state.activeSessionPath)
  const loading = useProjectsStore((state) => state.loading)

  return (
    <div className="bg-card flex h-full flex-col">
      <div className="window-drag flex h-12 shrink-0 items-center gap-2 pr-2 pl-[var(--titlebar-inset)]">
        <span className="text-sm font-medium">Piper</span>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-1">
        {projects.map((project) => (
          <ProjectGroup
            key={project.id}
            project={project}
            sessions={sessions[project.id] ?? []}
            expanded={expanded[project.id] ?? false}
            activeSessionPath={activeSessionPath}
            onToggle={() => projectActions.toggle(project.id)}
            onNewSession={() => void projectActions.newSession(project)}
            onOpenSession={(session) => void projectActions.openSession(project, session)}
          />
        ))}
        {projects.length === 0 && !loading && (
          <p className="text-accent-neutral px-2 py-3 text-xs">还没有项目</p>
        )}
      </div>

      <div className="border-accent-neutral/20 border-t p-2">
        <Button
          variant="ghost"
          size="sm"
          className="text-accent-neutral w-full justify-start gap-2"
          onClick={() => void projectActions.add()}
        >
          <Plus />
          添加项目
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-accent-neutral w-full justify-start gap-2"
          onClick={() => void projectActions.load()}
        >
          <RefreshCw />
          刷新
        </Button>
      </div>
    </div>
  )
}
