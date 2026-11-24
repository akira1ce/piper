import { create } from 'zustand'
import type { PiBatch, SessionStats } from '@shared/piProtocol'
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
  clearQueue: async (): Promise<void> => {
    const result = await window.api.pi.invoke({ type: 'clearQueue' })
    if (!result.ok) return
    const data = result.data as { steering: string[]; followUp: string[] }
    useChatStore.setState({ queue: { steering: data.steering, followUp: data.followUp } })
  }
}
