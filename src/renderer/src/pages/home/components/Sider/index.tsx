import { Moon, Plus, RefreshCw, Sun } from 'lucide-react'
import { Accordion } from '@renderer/components/ui/accordion'
import { Button } from '@renderer/components/ui/button'
import { themeActions, useThemeStore } from '@renderer/store/theme'
import { projectActions, useProjectsStore } from '../../store/projects'
import { ProjectGroup } from './ProjectGroup'

export function Sider(): React.JSX.Element {
  const projects = useProjectsStore((state) => state.projects)
  const sessions = useProjectsStore((state) => state.sessions)
  const expanded = useProjectsStore((state) => state.expanded)
  const activeSessionPath = useProjectsStore((state) => state.activeSessionPath)
  const loading = useProjectsStore((state) => state.loading)
  const theme = useThemeStore((state) => state.resolved)
  const expandedIds = projects
    .filter((project) => expanded[project.id])
    .map((project) => project.id)

  return (
    <div className="bg-card flex h-full flex-col">
      <div className="window-drag flex h-12 shrink-0 items-center justify-between gap-2 pr-2 pl-[var(--titlebar-inset)]">
        <span className="text-sm font-medium">Piper</span>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-accent-neutral window-no-drag"
          aria-label={theme === 'dark' ? '切换到浅色' : '切换到深色'}
          onClick={themeActions.toggle}
        >
          {theme === 'dark' ? <Sun /> : <Moon />}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-1">
        <Accordion type="multiple" value={expandedIds} onValueChange={projectActions.setExpanded}>
          {projects.map((project) => (
            <ProjectGroup
              key={project.id}
              project={project}
              sessions={sessions[project.id] ?? []}
              activeSessionPath={activeSessionPath}
              onNewSession={() => void projectActions.newSession(project)}
              onOpenSession={(session) => void projectActions.openSession(project, session)}
            />
          ))}
        </Accordion>
        {projects.length === 0 && !loading && (
          <div className="px-2 py-3">
            <p className="text-xs">还没有项目</p>
            <p className="text-accent-neutral mt-1 text-[11px]">
              点下方「添加项目」选一个目录，会话会按项目归类。
            </p>
          </div>
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
