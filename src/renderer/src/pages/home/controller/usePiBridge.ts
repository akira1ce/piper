import { useEffect } from 'react'
import { chatActions } from '../store/chat'

export function usePiBridge(): void {
  useEffect(() => window.api.pi.onEvent(chatActions.apply), [])
}
