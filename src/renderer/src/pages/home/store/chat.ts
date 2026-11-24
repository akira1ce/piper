import { create } from 'zustand'
import type { PiBatch } from '@shared/piProtocol'
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
  setSession: (sessionPath: string | null): void => useChatStore.setState({ sessionPath })
}
