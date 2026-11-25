import { ChevronRight, File as FileIcon, Folder as FolderIcon } from 'lucide-react'
import type { JSX, ReactNode } from 'react'
import { Button } from '@renderer/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@renderer/components/ui/collapsible'
import { cn } from '@renderer/lib/utils'

export interface FileTreeItem {
  name: string
  path: string
  isFile: boolean
  children: FileTreeItem[]
}

interface FileTreeProps {
  nodes: FileTreeItem[]
  selectedPath?: string | null
  onSelect?: (path: string) => void
  /** 行尾附加内容，例如变更统计 */
  renderSuffix?: (node: FileTreeItem) => ReactNode
  /** 目录默认展开深度（0 = 全部收起，1 = 顶层目录展开） */
  defaultOpenDepth?: number
  className?: string
}

export function FileTree({
  nodes,
  selectedPath,
  onSelect,
  renderSuffix,
  defaultOpenDepth = 1,
  className
}: FileTreeProps): JSX.Element {
  return (
    <div className={cn('flex w-full flex-col py-1 text-[11px]', className)}>
      {nodes.map((node) => (
        <FileTreeRow
          key={node.path}
          node={node}
          depth={0}
          selectedPath={selectedPath}
          onSelect={onSelect}
          renderSuffix={renderSuffix}
          defaultOpenDepth={defaultOpenDepth}
        />
      ))}
    </div>
  )
}

interface FileTreeRowProps {
  node: FileTreeItem
  depth: number
  selectedPath?: string | null
  onSelect?: (path: string) => void
  renderSuffix?: (node: FileTreeItem) => ReactNode
  defaultOpenDepth: number
}

function FileTreeRow({
  node,
  depth,
  selectedPath,
  onSelect,
  renderSuffix,
  defaultOpenDepth
}: FileTreeRowProps): JSX.Element {
  const indent = { paddingLeft: 4 + depth * 12 }

  if (!node.isFile) {
    return (
      <Collapsible defaultOpen={depth < defaultOpenDepth}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            style={indent}
            className="text-accent-neutral hover:text-fore group h-6 w-full justify-start gap-1 px-1 py-0 font-normal [&[data-state=open]_.chevron]:rotate-90"
          >
            <span className="chevron flex shrink-0 transition-transform">
              <ChevronRight className="size-3" />
            </span>
            <FolderIcon className="size-3 shrink-0" />
            <span className="min-w-0 flex-1 truncate text-left">{node.name}</span>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="flex flex-col">
            {node.children.map((child) => (
              <FileTreeRow
                key={child.path}
                node={child}
                depth={depth + 1}
                selectedPath={selectedPath}
                onSelect={onSelect}
                renderSuffix={renderSuffix}
                defaultOpenDepth={defaultOpenDepth}
              />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    )
  }

  const selected = node.path === selectedPath

  return (
    <Button
      variant="ghost"
      size="sm"
      style={indent}
      aria-current={selected ? 'true' : undefined}
      onClick={() => onSelect?.(node.path)}
      className={cn(
        'h-6 w-full justify-start gap-1 px-1 py-0 font-normal',
        selected ? 'bg-card-hover text-fore' : 'text-accent-neutral hover:text-fore'
      )}
    >
      <FileIcon className="size-3 shrink-0" />
      <span className="min-w-0 flex-1 truncate text-left">{node.name}</span>
      {renderSuffix?.(node)}
    </Button>
  )
}
