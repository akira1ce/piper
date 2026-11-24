import { Pencil, Trash2 } from 'lucide-react'
import { Dialog } from 'radix-ui'
import { useState } from 'react'
import type { JSX } from 'react'
import { Button } from '@renderer/components/ui/button'
import { chatActions, useChatStore } from '../../store/chat'
import { projectActions } from '../../store/projects'

interface SessionActionsProps {
  currentName: string
}

export function SessionActions({ currentName }: SessionActionsProps): JSX.Element | null {
  const sessionPath = useChatStore((state) => state.sessionPath)
  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [name, setName] = useState(currentName)

  if (!sessionPath) return null

  const rename = async (): Promise<void> => {
    const value = name.trim()
    if (!value) return
    const result = await window.api.pi.invoke({ type: 'renameSession', name: value })
    if (!result.ok) return
    setRenameOpen(false)
    await projectActions.load()
  }

  const remove = async (): Promise<void> => {
    const result = await window.api.pi.invoke({ type: 'deleteSession', sessionPath })
    if (!result.ok) return
    setDeleteOpen(false)
    chatActions.reset()
    await projectActions.load()
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        className="text-accent-neutral"
        aria-label="重命名会话"
        onClick={() => {
          setName(currentName)
          setRenameOpen(true)
        }}
      >
        <Pencil />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        className="text-accent-neutral"
        aria-label="删除会话"
        onClick={() => setDeleteOpen(true)}
      >
        <Trash2 />
      </Button>

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
    </>
  )
}
