import type { JSX } from 'react'
import { cn } from '@renderer/lib/utils'
import { splitFilePath } from '../controller/filePath'

interface FilePathLabelProps {
  path: string
  className?: string
}

/**
 * 长路径优先压缩左侧目录（省略号出现在左边），文件名保持完整；完整路径放在 title 里。
 * 目录片段用 rtl 容器取出左省略，再用 isolate 把内容还原成 ltr，避免斜杠分段被倒序。
 */
export function FilePathLabel({ path, className }: FilePathLabelProps): JSX.Element {
  const { dir, name } = splitFilePath(path)

  return (
    <span className={cn('flex min-w-0 items-baseline font-mono', className)} title={path}>
      {dir && (
        <span className="min-w-0 flex-1 truncate [direction:rtl]">
          <span className="[direction:ltr] [unicode-bidi:isolate]">{dir}</span>
        </span>
      )}
      <span className="min-w-0 truncate">{name}</span>
    </span>
  )
}
