import { create } from 'zustand'
import type { TurnChanges } from '@shared/piProtocol'

export type ReviewMode = 'accordion' | 'tree'

export const ACCORDION_LIMIT = 10

export function defaultReviewMode(fileCount: number): ReviewMode {
  return fileCount > ACCORDION_LIMIT ? 'tree' : 'accordion'
}

interface ReviewState {
  changes: TurnChanges | null
  selectedPath: string | null
  mode: ReviewMode
}

export const useReviewStore = create<ReviewState>(() => ({
  changes: null,
  selectedPath: null,
  mode: 'accordion'
}))

export const reviewActions = {
  open: (changes: TurnChanges, path?: string): void =>
    useReviewStore.setState({
      changes,
      selectedPath: path ?? changes.files[0]?.path ?? null,
      mode: defaultReviewMode(changes.files.length)
    }),
  select: (path: string): void => useReviewStore.setState({ selectedPath: path }),
  setMode: (mode: ReviewMode): void => useReviewStore.setState({ mode }),
  toggleMode: (): void =>
    useReviewStore.setState((state) => ({
      mode: state.mode === 'accordion' ? 'tree' : 'accordion'
    })),
  close: (): void => useReviewStore.setState({ changes: null, selectedPath: null })
}
