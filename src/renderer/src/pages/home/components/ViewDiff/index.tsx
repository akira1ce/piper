import { FileDiff, FolderTree, List } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { FileChange } from '@shared/piProtocol'
import { cn } from '@renderer/lib/utils'
import { buildTree } from '../../controller/fileTree'
import { useChatStore } from '../../store/chat'
import { reviewActions, useReviewStore } from '../../store/review'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@renderer/components/ui/accordion'
import { DiffLines } from './DiffLines'
import { FileTree } from './FileTree'

export function ViewDiff(): React.JSX.Element {
  const changes = useReviewStore((state) => state.changes)
  const selectedPath = useReviewStore((state) => state.selectedPath)
  const mode = useReviewStore((state) => state.mode)
  const cwd = useChatStore((state) => state.cwd)
  const [index, setIndex] = useState<{ owner: unknown; files: string[] }>({
    owner: null,
    files: []
  })

  useEffect(() => {
    if (!changes || !cwd || mode !== 'tree') return
    let alive = true
    void window.api.pi.invoke({ type: 'files', cwd }).then((result) => {
      if (!alive || !result.ok) return
      const data = result.data as { files: string[] }
      setIndex({ owner: changes, files: data.files })
    })
    return () => {
      alive = false
    }
  }, [changes, cwd, mode])

  const files = useMemo(() => (index.owner === changes ? index.files : []), [index, changes])
  const changedMap = useMemo(() => {
    const map = new Map<string, FileChange>()
    for (const file of changes?.files ?? []) map.set(file.path, file)
    return map
  }, [changes])
  const tree = useMemo(() => buildTree(files), [files])
  const selected = changes?.files.find((file) => file.path === selectedPath)

  if (!changes) {
    return (
      <div className="border-accent-neutral/20 flex h-full min-w-0 flex-col overflow-hidden border-l">
        <header className="window-drag flex h-12 shrink-0 items-center gap-2 px-3">
          <FileDiff className="text-accent-neutral size-4" />
          <span className="text-sm">变更</span>
        </header>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-accent-neutral text-xs">还没有文件变更</p>
        </div>
      </div>
    )
  }

  return (
    <div className="border-accent-neutral/20 flex h-full min-w-0 flex-col overflow-hidden border-l">
      <header className="window-drag flex h-12 shrink-0 items-center gap-2 px-3">
        <FileDiff className="text-accent-neutral size-4" />
        <span className="text-sm">变更</span>
        <span className="text-accent-neutral text-[11px]">{changes.files.length} 个文件</span>
        <div className="flex-1" />
        <div className="window-no-drag border-accent-neutral/20 flex items-center gap-0.5 rounded border p-0.5">
          <button
            type="button"
            aria-label="列表模式"
            onClick={() => reviewActions.setMode('accordion')}
            className={cn(
              'rounded p-0.5',
              mode === 'accordion'
                ? 'bg-card-hover text-fore'
                : 'text-accent-neutral hover:text-fore'
            )}
          >
            <List className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="文件树模式"
            onClick={() => reviewActions.setMode('tree')}
            className={cn(
              'rounded p-0.5',
              mode === 'tree' ? 'bg-card-hover text-fore' : 'text-accent-neutral hover:text-fore'
            )}
          >
            <FolderTree className="size-3.5" />
          </button>
        </div>
      </header>

      {mode === 'accordion' ? (
        <Accordion
          key={changes.files.map((file) => file.path).join('|')}
          type="multiple"
          defaultValue={changes.files.map((file) => file.path)}
          className="min-h-0 flex-1 space-y-2 overflow-auto p-2"
        >
          {changes.files.map((file) => (
            <AccordionItem
              key={file.path}
              value={file.path}
              className={cn(
                'border-accent-neutral/15 rounded-lg border px-3',
                selectedPath === file.path && 'border-accent-neutral/40'
              )}
            >
              <AccordionTrigger
                className="items-center gap-2 py-2 text-[11px] hover:no-underline"
                onClick={() => reviewActions.select(file.path)}
              >
                <span className="min-w-0 flex-1 truncate font-mono text-[11px]">{file.path}</span>
                <span className="text-accent-emerald shrink-0 text-[11px]">+{file.additions}</span>
                <span className="text-accent-rose shrink-0 text-[11px]">-{file.deletions}</span>
              </AccordionTrigger>
              <AccordionContent className="p-0">
                <DiffLines file={file} showHeader={false} />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      ) : (
        <div className="flex min-h-0 min-w-0 flex-1">
          <div className="border-accent-neutral/10 w-56 shrink-0 overflow-y-auto border-r">
            {tree.length > 0 ? (
              <FileTree
                nodes={tree}
                changed={changedMap}
                selected={selectedPath}
                onSelect={reviewActions.select}
              />
            ) : (
              <div className="p-1">
                {changes.files.map((file) => (
                  <button
                    key={file.path}
                    type="button"
                    onClick={() => reviewActions.select(file.path)}
                    className={cn(
                      'hover:bg-card-hover flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[11px]',
                      selectedPath === file.path && 'bg-card-hover text-fore'
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate font-mono">{file.path}</span>
                    <span className="text-accent-emerald shrink-0">+{file.additions}</span>
                    <span className="text-accent-rose shrink-0">-{file.deletions}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1 overflow-auto">
            {selected ? (
              <DiffLines file={selected} />
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-accent-neutral text-xs">
                  {selectedPath ? '该文件本轮没有变更' : '选择一个文件查看 diff'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
