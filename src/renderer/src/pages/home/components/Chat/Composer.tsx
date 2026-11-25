import { ArrowUp, Square } from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'
import { shouldSubmitOnEnter } from '../../controller/composerKeys'
import { getMentionContext, rankFiles } from '../../controller/fileMention'
import { useChatStore } from '../../store/chat'
import { getCaretCoordinates } from '../../util/textareaCaret'
import { FileMentionPopup } from './FileMentionPopup'

type Behavior = 'steer' | 'followUp'

export function Composer(): React.JSX.Element {
  const [text, setText] = useState('')
  const [behavior, setBehavior] = useState<Behavior>('steer')
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [caret, setCaret] = useState({
    top: 0,
    left: 0,
    maxHeight: 256,
    placement: 'below' as 'above' | 'below'
  })
  const composingRef = useRef(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [fileCache, setFileCache] = useState<{ cwd: string; files: string[] } | null>(null)
  const [filesLoading, setFilesLoading] = useState(false)
  const status = useChatStore((state) => state.status)
  const sessionPath = useChatStore((state) => state.sessionPath)
  const cwd = useChatStore((state) => state.cwd)
  const running = status === 'running' || status === 'compacting'

  const ensureFiles = useCallback(
    async (requestedCwd: string | null): Promise<void> => {
      if (!requestedCwd || fileCache?.cwd === requestedCwd) return
      setFilesLoading(true)
      try {
        const result = await window.api.pi.invoke({ type: 'files', cwd: requestedCwd })
        if (result.ok) {
          setFileCache({ cwd: requestedCwd, files: (result.data as { files: string[] }).files })
        }
      } finally {
        setFilesLoading(false)
      }
    },
    [fileCache]
  )

  const candidates = useMemo(() => {
    if (!mention || !fileCache || fileCache.cwd !== cwd) return []
    return rankFiles(fileCache.files, mention.query, 30)
  }, [mention, fileCache, cwd])

  const mentionOpen = mention !== null && (filesLoading || candidates.length > 0)

  const refreshMention = useCallback((): void => {
    const node = textareaRef.current
    if (!node) return
    const context = getMentionContext(node.value, node.selectionStart)
    setMention((previous) => {
      if (previous?.query !== context?.query || previous?.start !== context?.start) {
        setActiveIndex(0)
      }
      return context
    })
    if (context) {
      const { left, top, height } = getCaretCoordinates(node, context.start)
      const rect = node.getBoundingClientRect()
      const lineTop = rect.top + top - node.scrollTop
      const lineBottom = lineTop + height
      const spaceBelow = window.innerHeight - lineBottom - 12
      const spaceAbove = lineTop - 12
      const placement = spaceBelow >= 200 || spaceBelow >= spaceAbove ? 'below' : 'above'
      setCaret({
        top: placement === 'below' ? lineBottom + 4 : lineTop - 4,
        left: Math.max(8, Math.min(rect.left + left, window.innerWidth - 328)),
        maxHeight: Math.max(120, Math.min(320, placement === 'below' ? spaceBelow : spaceAbove)),
        placement
      })
      void ensureFiles(cwd)
    }
  }, [cwd, ensureFiles])

  const pickFile = (path: string): void => {
    const node = textareaRef.current
    if (!node || !mention) return
    const caretEnd = node.selectionStart
    const next = `${text.slice(0, mention.start)}@${path} ${text.slice(caretEnd)}`
    const position = mention.start + path.length + 2
    setText(next)
    setMention(null)
    requestAnimationFrame(() => {
      node.focus()
      node.setSelectionRange(position, position)
    })
  }

  const send = async (): Promise<void> => {
    const value = text.trim()
    if (!value) return
    try {
      const result = await window.api.pi.invoke({
        type: 'prompt',
        text: value,
        ...(running ? { behavior } : {})
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setText('')
      setMention(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }

  const abort = async (): Promise<void> => {
    const result = await window.api.pi.invoke({ type: 'abort' })
    if (!result.ok) toast.error(result.error)
  }

  return (
    <footer className="shrink-0 px-4 pb-4">
      <div className="bg-card focus-within:border-accent-neutral/50 relative mx-auto flex max-w-3xl flex-col gap-2 rounded-xl border border-accent-neutral/25 p-2">
        {mentionOpen && (
          <FileMentionPopup
            items={candidates}
            activeIndex={activeIndex}
            onPick={pickFile}
            onHover={setActiveIndex}
            loading={filesLoading}
            position={caret}
          />
        )}
        <textarea
          ref={textareaRef}
          rows={2}
          value={text}
          placeholder={sessionPath ? '给 pi 发消息…' : '先在左侧选择或新建一个会话'}
          disabled={!sessionPath}
          onChange={(event) => {
            setText(event.target.value)
            refreshMention()
          }}
          onKeyUp={refreshMention}
          onClick={refreshMention}
          onBlur={() => setMention(null)}
          onCompositionStart={() => {
            composingRef.current = true
          }}
          onCompositionEnd={() => {
            composingRef.current = false
          }}
          onKeyDown={(event) => {
            if (mentionOpen && candidates.length > 0) {
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setActiveIndex((index) => (index + 1) % candidates.length)
                return
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault()
                setActiveIndex((index) => (index - 1 + candidates.length) % candidates.length)
                return
              }
              if (event.key === 'Enter' || event.key === 'Tab') {
                event.preventDefault()
                pickFile(candidates[activeIndex])
                return
              }
            }
            if (mentionOpen && event.key === 'Escape') {
              event.preventDefault()
              setMention(null)
              return
            }
            const native = event.nativeEvent as KeyboardEvent
            const submit = shouldSubmitOnEnter({
              key: event.key,
              shiftKey: event.shiftKey,
              isComposing: composingRef.current || native.isComposing,
              keyCode: native.keyCode
            })
            if (submit) {
              event.preventDefault()
              void send()
            }
          }}
          className="placeholder:text-accent-neutral/70 w-full resize-none bg-transparent px-2 py-1 text-sm outline-none disabled:opacity-50"
        />
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="text-accent-neutral text-[11px]">Enter 发送 · Shift+Enter 换行</span>
            {running && (
              <div className="border-accent-neutral/20 flex items-center gap-1 rounded border p-0.5">
                {(['steer', 'followUp'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setBehavior(value)}
                    className={cn(
                      'rounded px-1.5 py-0.5 text-[10px]',
                      behavior === value
                        ? 'bg-card-hover text-fore'
                        : 'text-accent-neutral hover:text-fore'
                    )}
                  >
                    {value === 'steer' ? '引导' : '追问'}
                  </button>
                ))}
              </div>
            )}
          </div>
          {running ? (
            <Button
              size="icon-sm"
              variant="secondary"
              aria-label="中断"
              onClick={() => void abort()}
            >
              <Square />
            </Button>
          ) : (
            <Button
              size="icon-sm"
              aria-label="发送"
              disabled={!sessionPath || !text.trim()}
              onClick={() => void send()}
            >
              <ArrowUp />
            </Button>
          )}
        </div>
      </div>
    </footer>
  )
}
