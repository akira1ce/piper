import { Pencil, Trash2 } from 'lucide-react'
import { Dialog } from 'radix-ui'
import { useState } from 'react'
import type { JSX } from 'react'
import type { SessionSummary } from '@shared/piProtocol'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'
import { chatActions } from '../../store/chat'
import { projectActions, useProjectsStore } from '../../store/projects'

interface SessionRowProps {
  projectId: string
  session: SessionSummary
  active: boolean
  onOpen: () => void
}

export function SessionRow({ projectId, session, active, onOpen }: SessionRowProps): JSX.Element {
  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [name, setName] = useState(session.name ?? session.firstMessage)

  const rename = async (): Promise<void> => {
    const value = name.trim()
    if (!value) return
    const result = await window.api.pi.invoke({ type: 'renameSession', name: value })
    if (!result.ok) return
    setRenameOpen(false)
    await projectActions.loadSessions(projectId)
  }

  const remove = async (): Promise<void> => {
    const result = await window.api.pi.invoke({ type: 'deleteSession', sessionPath: session.path })
    if (!result.ok) return
    setDeleteOpen(false)
    const { activeSessionPath } = useProjectsStore.getState()
    if (activeSessionPath === session.path) {
      chatActions.reset()
      useProjectsStore.setState({ activeSessionPath: null })
    }
    await projectActions.loadSessions(projectId)
  }

  return (
    <div className="group/row relative">
      <button
        type="button"
        data-session-path={session.path}
        onClick={onOpen}
        className={cn(
          'text-fore/80 hover:bg-card-hover w-full truncate rounded py-1.5 pr-14 pl-2 text-left text-xs',
          active && 'bg-card-hover text-fore'
        )}
        title={session.name ?? session.firstMessage}
      >
        {session.name || session.firstMessage || '未命名会话'}
      </button>

      <div className="bg-card-hover absolute top-1/2 right-1 flex -translate-y-1/2 items-center gap-0.5 rounded px-0.5 opacity-0 group-hover/row:opacity-100">
        <button
          type="button"
          aria-label="重命名会话"
          onClick={() => {
            setName(session.name ?? session.firstMessage)
            setRenameOpen(true)
          }}
          className="text-accent-neutral hover:text-fore p-0.5"
        >
          <Pencil className="size-3" />
        </button>
        <button
          type="button"
          aria-label="删除会话"
          onClick={() => setDeleteOpen(true)}
          className="text-accent-neutral hover:text-accent-rose p-0.5"
        >
          <Trash2 className="size-3" />
        </button>
      </div>

      <Dialog.Root open={renameOpen} onOpenChange={setRenameOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="bg-main/80 fixed inset-0 z-50" />
          <Dialog.Content
            aria-describedby={undefined}
            className="bg-card border-accent-neutral/30 fixed top-1/2 left-1/2 z-50 w-[min(400px,90vw)] -translate-x-1/2 -translate-y-1/2 rounded-xl border p-4 shadow-xl"
          >
            <Dialog.Title className="text-sm">重命名会话</Dialog.Title>
            <input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && void rename()}
              className="border-accent-neutral/30 bg-main/40 mt-3 w-full rounded border px-2 py-1.5 text-xs outline-none"
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setRenameOpen(false)}>
                取消
              </Button>
              <Button size="sm" disabled={!name.trim()} onClick={() => void rename()}>
                保存
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={deleteOpen} onOpenChange={setDeleteOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="bg-main/80 fixed inset-0 z-50" />
          <Dialog.Content
            aria-describedby={undefined}
            className="bg-card border-accent-neutral/30 fixed top-1/2 left-1/2 z-50 w-[min(400px,90vw)] -translate-x-1/2 -translate-y-1/2 rounded-xl border p-4 shadow-xl"
          >
            <Dialog.Title className="text-sm">删除会话</Dialog.Title>
            <Dialog.Description className="text-accent-neutral mt-2 text-xs">
              会话文件会移入回收站，此操作可以撤销。
            </Dialog.Description>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setDeleteOpen(false)}>
                取消
              </Button>
              <Button variant="destructive" size="sm" onClick={() => void remove()}>
                删除
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
