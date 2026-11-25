import type { JSX } from 'react'
import type { FileChange } from '@shared/piProtocol'
import { cn } from '@renderer/lib/utils'
import { parsePatch } from '../../controller/changes'

interface DiffLinesProps {
  file: FileChange
}

export function DiffLines({ file }: DiffLinesProps): JSX.Element {
  const lines = parsePatch(file.patch)

  return (
    <div className="min-w-0 font-mono text-[11px]">
      <div className="bg-card border-accent-neutral/10 sticky top-0 z-10 flex items-center gap-2 border-b px-3 py-1.5">
        <span className="min-w-0 flex-1 truncate">{file.path}</span>
        <span className="text-accent-emerald shrink-0">+{file.additions}</span>
        <span className="text-accent-rose shrink-0">-{file.deletions}</span>
      </div>
      <div className="pb-4">
        {lines.map((line, index) =>
          line.type === 'hunk' ? (
            <div
              key={index}
              className="text-accent-neutral bg-main/60 px-3 py-0.5 whitespace-pre-wrap"
            >
              {line.text}
            </div>
          ) : (
            <div
              key={index}
              className={cn(
                'flex px-3',
                line.type === 'add' && 'bg-accent-emerald/10',
                line.type === 'del' && 'bg-accent-rose/10'
              )}
            >
              <span className="text-accent-neutral/50 w-8 shrink-0 pr-2 text-right select-none">
                {line.oldLine ?? ''}
              </span>
              <span className="text-accent-neutral/50 w-8 shrink-0 pr-2 text-right select-none">
                {line.newLine ?? ''}
              </span>
              <span
                className={cn(
                  'w-4 shrink-0 text-center select-none',
                  line.type === 'add' && 'text-accent-emerald',
                  line.type === 'del' && 'text-accent-rose'
                )}
              >
                {line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' '}
              </span>
              <span className="min-w-0 flex-1 whitespace-pre-wrap break-all">{line.text}</span>
            </div>
          )
        )}
      </div>
    </div>
  )
}
