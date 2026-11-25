import { create } from 'zustand'
import type { Project, SessionSummary } from '@shared/piProtocol'
import { chatActions } from './chat'
import { reviewActions } from './review'

export interface ProjectsState {
  projects: Project[]
  sessions: Record<string, SessionSummary[]>
  expanded: Record<string, boolean>
  activeSessionPath: string | null
  loading: boolean
}

export const useProjectsStore = create<ProjectsState>(() => ({
  projects: [],
  sessions: {},
  expanded: {},
  activeSessionPath: null,
  loading: false
}))

let restored = false

export const projectActions = {
  load: async (): Promise<void> => {
    useProjectsStore.setState({ loading: true })
    const result = await window.api.pi.invoke({ type: 'projects' })
    if (!result.ok) {
      useProjectsStore.setState({ loading: false })
      return
    }
    const projects = result.data as Project[]
    useProjectsStore.setState((state) => ({
      projects,
      loading: false,
      expanded: {
        ...Object.fromEntries(projects.map((project) => [project.id, true])),
        ...state.expanded
      }
    }))
    await Promise.all(projects.map((project) => projectActions.loadSessions(project.id)))
    await projectActions.restoreLastSession()
  },

  restoreLastSession: async (): Promise<void> => {
    if (restored) return
    restored = true
    const result = await window.api.pi.invoke({ type: 'lastSession' })
    if (!result.ok) return
    const state = result.data as { lastProjectId?: string; lastSessionPath?: string }
    if (!state.lastProjectId || !state.lastSessionPath) return
    const project = useProjectsStore
      .getState()
      .projects.find((item) => item.id === state.lastProjectId)
    if (!project?.available) return
    const sessions = useProjectsStore.getState().sessions[project.id] ?? []
    const session = sessions.find((item) => item.path === state.lastSessionPath)
    if (!session) return
    await projectActions.openSession(project, session)
  },

  loadSessions: async (projectId: string): Promise<void> => {
    const result = await window.api.pi.invoke({ type: 'sessions', projectId })
    if (!result.ok) return
    useProjectsStore.setState((state) => ({
      sessions: { ...state.sessions, [projectId]: result.data as SessionSummary[] }
    }))
  },

  add: async (): Promise<void> => {
    const result = await window.api.pi.invoke({ type: 'addProject' })
    if (!result.ok) return
    await projectActions.load()
  },

  remove: async (projectId: string): Promise<void> => {
    await window.api.pi.invoke({ type: 'removeProject', projectId })
    await projectActions.load()
  },

  rename: async (projectId: string, name: string): Promise<void> => {
    await window.api.pi.invoke({ type: 'renameProject', projectId, name })
    await projectActions.load()
  },

  activeProject: (): Project | undefined => {
    const { projects, sessions, activeSessionPath } = useProjectsStore.getState()
    for (const project of projects) {
      if ((sessions[project.id] ?? []).some((session) => session.path === activeSessionPath)) {
        return project
      }
    }
    return projects.find((project) => project.available)
  },

  setExpanded: (projectIds: string[]): void =>
    useProjectsStore.setState((state) => ({
      expanded: Object.fromEntries(
        state.projects.map((project) => [project.id, projectIds.includes(project.id)])
      )
    })),

  newSession: async (project: Project): Promise<void> => {
    // 不带 --session 启动 pi 本身就会创建新会话，无需再发 new_session
    const result = await window.api.pi.invoke({ type: 'start', cwd: project.path })
    if (!result.ok) return
    const state = await window.api.pi.invoke({ type: 'state' })
    if (state.ok) {
      const data = state.data as { sessionFile?: string }
      chatActions.reset()
      reviewActions.close()
      chatActions.setContext(project.path, data.sessionFile ?? null)
      useProjectsStore.setState({ activeSessionPath: data.sessionFile ?? null })
      if (data.sessionFile) {
        await window.api.pi.invoke({
          type: 'rememberSession',
          projectId: project.id,
          sessionPath: data.sessionFile
        })
      }
    }
    await projectActions.loadSessions(project.id)
  },

  openSession: async (project: Project, session: SessionSummary): Promise<void> => {
    const result = await window.api.pi.invoke({
      type: 'start',
      cwd: project.path,
      sessionPath: session.path
    })
    if (!result.ok) return
    chatActions.reset()
    reviewActions.close()
    chatActions.setContext(project.path, session.path)
    useProjectsStore.setState({ activeSessionPath: session.path })
    const state = await window.api.pi.invoke({ type: 'state' })
    if (state.ok) {
      const data = state.data as { sessionFile?: string }
      useProjectsStore.setState({ activeSessionPath: data.sessionFile ?? session.path })
      chatActions.setContext(project.path, data.sessionFile ?? session.path)
    }
    const messages = await window.api.pi.invoke({ type: 'messages' })
    if (messages.ok) {
      chatActions.loadMessages((messages.data as { messages: unknown[] }).messages)
    }
    await window.api.pi.invoke({
      type: 'rememberSession',
      projectId: project.id,
      sessionPath: useProjectsStore.getState().activeSessionPath ?? session.path
    })
  }
}
