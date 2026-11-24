import { create } from 'zustand'
import type { ModelInfo, PiBatch, SessionStats, ThinkingLevel } from '@shared/piProtocol'
import { messagesToView } from '../controller/messagesToView'
import { initialChatView, reduceBatch, type ChatView } from '../controller/reducePiEvent'

export const useChatStore = create<ChatView>(() => initialChatView())

export const chatActions = {
  apply: (batch: PiBatch): void => useChatStore.setState((view) => reduceBatch(view, batch)),
  loadMessages: (raw: unknown[]): void => {
    const { messages, toolCalls } = messagesToView(raw)
    useChatStore.setState({ messages, toolCalls })
  },
  reset: (): void => useChatStore.setState(initialChatView(), true),
  setSession: (sessionPath: string | null): void => useChatStore.setState({ sessionPath }),
  abortRetry: async (): Promise<void> => {
    await window.api.pi.invoke({ type: 'abortRetry' })
  },
  loadStats: async (): Promise<void> => {
    const result = await window.api.pi.invoke({ type: 'stats' })
    if (!result.ok) return
    useChatStore.setState({ stats: result.data as SessionStats })
  },
  loadMeta: async (): Promise<void> => {
    const [state, models, levels] = await Promise.all([
      window.api.pi.invoke({ type: 'state' }),
      window.api.pi.invoke({ type: 'models' }),
      window.api.pi.invoke({ type: 'thinkingLevels' })
    ])
    useChatStore.setState((view) => ({
      model: state.ok ? ((state.data as { model?: ModelInfo }).model ?? null) : view.model,
      modelList: models.ok ? (models.data as { models: ModelInfo[] }).models : view.modelList,
      thinkingLevels: levels.ok
        ? (levels.data as { levels: ThinkingLevel[] }).levels
        : view.thinkingLevels,
      thinkingLevel: state.ok
        ? ((state.data as { thinkingLevel?: ThinkingLevel }).thinkingLevel ?? view.thinkingLevel)
        : view.thinkingLevel
    }))
  },
  setModel: async (provider: string, modelId: string): Promise<void> => {
    const result = await window.api.pi.invoke({ type: 'setModel', provider, modelId })
    if (result.ok) await chatActions.loadMeta()
  },
  setThinkingLevel: async (level: ThinkingLevel): Promise<void> => {
    const result = await window.api.pi.invoke({ type: 'setThinkingLevel', level })
    if (result.ok) useChatStore.setState({ thinkingLevel: level })
  },
  respondExtension: async (
    id: string,
    payload: { value?: string; confirmed?: boolean; cancelled?: boolean }
  ): Promise<void> => {
    await window.api.pi.invoke({ type: 'extensionRespond', id, ...payload })
    useChatStore.setState((view) => ({
      dialogs: view.dialogs.filter((dialog) => dialog.id !== id)
    }))
  },
  clearQueue: async (): Promise<void> => {
    const result = await window.api.pi.invoke({ type: 'clearQueue' })
    if (!result.ok) return
    const data = result.data as { steering: string[]; followUp: string[] }
    useChatStore.setState({ queue: { steering: data.steering, followUp: data.followUp } })
  }
}
