import { create } from 'zustand'
import type { TurnChanges } from '@shared/piProtocol'

interface ReviewState {
  changes: TurnChanges | null
  selectedPath: string | null
}

export const useReviewStore = create<ReviewState>(() => ({
  changes: null,
  selectedPath: null
}))

export const reviewActions = {
  open: (changes: TurnChanges, path?: string): void =>
    useReviewStore.setState({
      changes,
      selectedPath: path ?? changes.files[0]?.path ?? null
    }),
  select: (path: string): void => useReviewStore.setState({ selectedPath: path }),
  close: (): void => useReviewStore.setState({ changes: null, selectedPath: null })
}
