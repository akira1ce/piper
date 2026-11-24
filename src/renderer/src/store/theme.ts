import { create } from 'zustand'

export type ThemeMode = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'piper:theme'

export function resolveTheme(mode: ThemeMode, systemDark: boolean): ResolvedTheme {
  if (mode === 'system') return systemDark ? 'dark' : 'light'
  return mode
}

interface ThemeState {
  mode: ThemeMode
  resolved: ResolvedTheme
}

export const useThemeStore = create<ThemeState>(() => ({ mode: 'dark', resolved: 'dark' }))

function media(): MediaQueryList {
  return window.matchMedia('(prefers-color-scheme: dark)')
}

function apply(resolved: ResolvedTheme): void {
  document.documentElement.classList.toggle('dark', resolved === 'dark')
  void window.api.pi.invoke({ type: 'setTheme', theme: resolved })
}

function commit(mode: ThemeMode): ResolvedTheme {
  const resolved = resolveTheme(mode, media().matches)
  useThemeStore.setState({ mode, resolved })
  apply(resolved)
  return resolved
}

let listening = false

export const themeActions = {
  init: (): void => {
    const stored = localStorage.getItem(STORAGE_KEY)
    const mode: ThemeMode =
      stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'dark'
    commit(mode)
    if (listening) return
    listening = true
    media().addEventListener('change', () => {
      if (useThemeStore.getState().mode === 'system') commit('system')
    })
  },

  setMode: (mode: ThemeMode): void => {
    localStorage.setItem(STORAGE_KEY, mode)
    commit(mode)
  },

  toggle: (): void => {
    themeActions.setMode(useThemeStore.getState().resolved === 'dark' ? 'light' : 'dark')
  }
}
