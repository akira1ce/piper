import { ChevronRight } from 'lucide-react'
import { useState } from 'react'
import type { JSX } from 'react'
import type { FileChange } from '@shared/piProtocol'
import { cn } from '@renderer/lib/utils'
import { DiffLines } from './DiffLines'

interface FileDiffSectionProps {
  file: FileChange
  selected: boolean
  onSelect: () => void
}

export function FileDiffSection({ file, selected, onSelect }: FileDiffSectionProps): JSX.Element {
  const [open, setOpen] = useState(true)

  return (
    <div
      className={cn(
        'border-accent-neutral/15 rounded-lg border',
        selected && 'border-accent-neutral/40'
      )}
    >
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value)
          onSelect()
        }}
        className="hover:bg-card-hover flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left"
      >
        <ChevronRight className={cn('size-3 shrink-0 transition-transform', open && 'rotate-90')} />
        <span className="min-w-0 flex-1 truncate font-mono text-[11px]">{file.path}</span>
        <span className="text-accent-emerald shrink-0 text-[11px]">+{file.additions}</span>
        <span className="text-accent-rose shrink-0 text-[11px]">-{file.deletions}</span>
      </button>
      {open && <DiffLines file={file} showHeader={false} />}
    </div>
  )
}
