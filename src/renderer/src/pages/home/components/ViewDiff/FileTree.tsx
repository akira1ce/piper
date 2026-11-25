import { ChevronRight, File, Folder, FolderOpen } from 'lucide-react'
import { useState } from 'react'
import type { JSX } from 'react'
import type { FileChange } from '@shared/piProtocol'
import { cn } from '@renderer/lib/utils'
import type { FileNode } from '../../controller/fileTree'

interface FileTreeProps {
  nodes: FileNode[]
  changed: Map<string, FileChange>
  selected: string | null
  onSelect: (path: string) => void
}

export function FileTree({ nodes, changed, selected, onSelect }: FileTreeProps): JSX.Element {
  return (
    <div className="py-1">
      {nodes.map((node) => (
        <TreeRow
          key={node.path}
          node={node}
          depth={0}
          changed={changed}
          selected={selected}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}

interface TreeRowProps {
  node: FileNode
  depth: number
  changed: Map<string, FileChange>
  selected: string | null
  onSelect: (path: string) => void
}

function TreeRow({ node, depth, changed, selected, onSelect }: TreeRowProps): JSX.Element {
  const [open, setOpen] = useState(depth === 0)
  const change = changed.get(node.path)

  if (!node.isFile) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="text-accent-neutral hover:text-fore flex w-full items-center gap-1 py-0.5 pr-2 text-left text-[11px]"
          style={{ paddingLeft: 8 + depth * 12 }}
        >
          <ChevronRight
            className={cn('size-3 shrink-0 transition-transform', open && 'rotate-90')}
          />
          {open ? (
            <FolderOpen className="size-3 shrink-0" />
          ) : (
            <Folder className="size-3 shrink-0" />
          )}
          <span className="truncate">{node.name}</span>
        </button>
        {open && (
          <div>
            {node.children.map((child) => (
              <TreeRow
                key={child.path}
                node={child}
                depth={depth + 1}
                changed={changed}
                selected={selected}
                onSelect={onSelect}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(node.path)}
      className={cn(
        'hover:bg-card-hover flex w-full items-center gap-1 py-0.5 pr-2 text-left text-[11px]',
        selected === node.path && 'bg-card-hover text-fore',
        change ? 'text-fore' : 'text-accent-neutral'
      )}
      style={{ paddingLeft: 8 + depth * 12 }}
    >
      <File className="size-3 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{node.name}</span>
      {change && (
        <span className="shrink-0 text-[10px]">
          <span className="text-accent-emerald">+{change.additions}</span>{' '}
          <span className="text-accent-rose">-{change.deletions}</span>
        </span>
      )}
    </button>
  )
}
