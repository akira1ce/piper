import { useCallback, useEffect, useRef, useState } from 'react'

const STICK_THRESHOLD = 48

/**
 * 虚拟列表的贴底滚动。
 * - 用户停在底部时，内容变化自动跟到底部
 * - 用户上翻后不再打扰，回到底部后恢复跟随
 */
export function useStickToBottom(deps: unknown): {
  containerRef: React.RefObject<HTMLDivElement | null>
  atBottom: boolean
  scrollToBottom: (behavior?: 'auto' | 'smooth') => void
} {
  const containerRef = useRef<HTMLDivElement>(null)
  const stickRef = useRef(true)
  const [atBottom, setAtBottom] = useState(true)

  const scrollToBottom = useCallback((behavior: 'auto' | 'smooth' = 'auto'): void => {
    const element = containerRef.current
    if (!element) return
    element.scrollTo({ top: element.scrollHeight, behavior })
    stickRef.current = true
    setAtBottom(true)
  }, [])

  const onScroll = useCallback((): void => {
    const element = containerRef.current
    if (!element) return
    const bottom = element.scrollHeight - element.scrollTop - element.clientHeight < STICK_THRESHOLD
    stickRef.current = bottom
    setAtBottom(bottom)
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
