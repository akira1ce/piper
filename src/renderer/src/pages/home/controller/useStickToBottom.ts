import { useCallback, useEffect, useRef, useState } from 'react'

export function useStickToBottom(deps: unknown): {
  containerRef: React.RefObject<HTMLDivElement | null>
  atBottom: boolean
  scrollToBottom: () => void
} {
  const containerRef = useRef<HTMLDivElement>(null)
  const stickRef = useRef(true)
  const [atBottom, setAtBottom] = useState(true)

  const onScroll = useCallback(() => {
    const element = containerRef.current
    if (!element) return
    const bottom = element.scrollHeight - element.scrollTop - element.clientHeight < 48
    stickRef.current = bottom
    setAtBottom(bottom)
  }, [])

  const scrollToBottom = useCallback(() => {
    const element = containerRef.current
    if (!element) return
    element.scrollTop = element.scrollHeight
    stickRef.current = true
    setAtBottom(true)
  }, [])

  useEffect(() => {
    if (stickRef.current) scrollToBottom()
  }, [deps, scrollToBottom])

  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    element.addEventListener('scroll', onScroll, { passive: true })
    return () => element.removeEventListener('scroll', onScroll)
  }, [onScroll])

  return { containerRef, atBottom, scrollToBottom }
}
