import { create } from 'zustand'

/** 只在 home 页面内部共享的 UI 状态；跨页面使用的状态才提到 src/renderer/src/store */
export interface HomeUiState {
  sidebarCollapsed: boolean
  diffVisible: boolean
}

export const useUiStore = create<HomeUiState>(() => ({
  sidebarCollapsed: false,
  diffVisible: true
}))

export const uiActions = {
  toggleSidebar: (): void =>
    useUiStore.setState((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  toggleDiff: (): void => useUiStore.setState((state) => ({ diffVisible: !state.diffVisible })),
  showDiff: (): void => useUiStore.setState({ diffVisible: true })
}
