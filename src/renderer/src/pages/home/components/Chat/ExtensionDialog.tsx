import { Dialog } from 'radix-ui'
import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import type { ExtensionUiRequest } from '@shared/piProtocol'
import { Button } from '@renderer/components/ui/button'
import { chatActions, useChatStore } from '../../store/chat'

export function ExtensionDialog(): JSX.Element | null {
  const request = useChatStore((state) => state.dialogs[0])
  if (!request) return null
  return <ExtensionDialogBody key={request.id} request={request} />
}

function ExtensionDialogBody({ request }: { request: ExtensionUiRequest }): JSX.Element {
  const [value, setValue] = useState(request.prefill ?? '')
  const [remaining, setRemaining] = useState<number | null>(
    request.timeout ? Math.ceil(request.timeout / 1000) : null
  )

  useEffect(() => {
    if (!request.timeout) return
    const timer = setInterval(() => {
      setRemaining((current) => {
        if (current === null) return current
        if (current <= 1) {
          clearInterval(timer)
          void chatActions.respondExtension(request.id, { cancelled: true })
          return 0
        }
        return current - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [request.id, request.timeout])

  const respond = (payload: { value?: string; confirmed?: boolean; cancelled?: boolean }): void => {
    void chatActions.respondExtension(request.id, payload)
  }

  return (
    <Dialog.Root open onOpenChange={(open) => !open && respond({ cancelled: true })}>
      <Dialog.Portal>
        <Dialog.Overlay className="bg-main/80 fixed inset-0 z-50" />
        <Dialog.Content
          aria-describedby={undefined}
          className="bg-card border-accent-neutral/30 fixed top-1/2 left-1/2 z-50 w-[min(440px,90vw)] -translate-x-1/2 -translate-y-1/2 rounded-xl border p-4 shadow-xl"
        >
          <div className="flex items-start justify-between gap-3">
            <Dialog.Title className="text-sm">{titleOf(request)}</Dialog.Title>
            {remaining !== null && (
              <span className="text-accent-neutral shrink-0 text-[11px]">{remaining}s</span>
            )}
          </div>
          {request.message && (
            <p className="text-accent-neutral mt-2 text-xs whitespace-pre-wrap">
              {request.message}
            </p>
          )}

          <div className="mt-3">
            {request.method === 'select' && (
              <div className="space-y-1">
                {(request.options ?? []).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => respond({ value: option })}
                    className="border-accent-neutral/20 hover:bg-card-hover w-full rounded border px-3 py-1.5 text-left text-xs"
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
            {request.method === 'input' && (
              <input
                autoFocus
                value={value}
                onChange={(event) => setValue(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && respond({ value })}
                className="border-accent-neutral/30 bg-main/40 w-full rounded border px-2 py-1.5 text-xs outline-none"
              />
            )}
            {request.method === 'editor' && (
              <textarea
                autoFocus
                rows={6}
                value={value}
                onChange={(event) => setValue(event.target.value)}
                className="border-accent-neutral/30 bg-main/40 w-full resize-none rounded border px-2 py-1.5 font-mono text-xs outline-none"
              />
            )}
          </div>

          <div className="mt-4 flex justify-end gap-2">
            {request.method === 'confirm' ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => respond({ confirmed: false })}>
                  取消
                </Button>
                <Button size="sm" onClick={() => respond({ confirmed: true })}>
                  确定
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => respond({ cancelled: true })}>
                  取消
                </Button>
                {(request.method === 'input' || request.method === 'editor') && (
                  <Button size="sm" onClick={() => respond({ value })}>
                    提交
                  </Button>
                )}
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function titleOf(request: ExtensionUiRequest): string {
  if (request.title) return request.title
  switch (request.method) {
    case 'select':
      return '选择一个选项'
    case 'confirm':
      return '确认'
    case 'input':
      return '输入'
    case 'editor':
      return '编辑'
    default:
      return '扩展请求'
  }
}
