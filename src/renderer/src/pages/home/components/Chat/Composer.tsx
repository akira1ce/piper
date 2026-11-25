import { ArrowUp, Square } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'
import { shouldSubmitOnEnter } from '../../controller/composerKeys'
import { useChatStore } from '../../store/chat'

type Behavior = 'steer' | 'followUp'

export function Composer(): React.JSX.Element {
  const [text, setText] = useState('')
  const [behavior, setBehavior] = useState<Behavior>('steer')
  const composingRef = useRef(false)
  const status = useChatStore((state) => state.status)
  const sessionPath = useChatStore((state) => state.sessionPath)
  const running = status === 'running' || status === 'compacting'

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
      <div className="bg-card focus-within:border-accent-neutral/50 mx-auto flex max-w-3xl flex-col gap-2 rounded-xl border border-accent-neutral/25 p-2">
        <textarea
          rows={2}
          value={text}
          placeholder={sessionPath ? '给 pi 发消息…' : '先在左侧选择或新建一个会话'}
          disabled={!sessionPath}
          onChange={(event) => setText(event.target.value)}
          onCompositionStart={() => {
            composingRef.current = true
          }}
          onCompositionEnd={() => {
            composingRef.current = false
          }}
          onKeyDown={(event) => {
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
