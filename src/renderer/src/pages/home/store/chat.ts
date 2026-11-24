import { create } from 'zustand'
import type { PiBatch } from '@shared/piProtocol'
import { initialChatView, reduceBatch, type ChatView } from '../controller/reducePiEvent'

export const useChatStore = create<ChatView>(() => initialChatView())

export const chatActions = {
  apply: (batch: PiBatch): void => useChatStore.setState((view) => reduceBatch(view, batch)),
  reset: (): void => useChatStore.setState(initialChatView(), true),
  setSession: (sessionPath: string | null): void => useChatStore.setState({ sessionPath })
}
