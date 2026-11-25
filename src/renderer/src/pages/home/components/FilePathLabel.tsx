import type { JSX } from 'react'
import { cn } from '@renderer/lib/utils'

interface FilePathLabelProps {
  path: string
  className?: string
}

/**
 * 路径始终左对齐；超长时从左侧省略，保留下能辨识的尾部（文件名）。
 * 做法：rtl 容器让溢出发生在左边、省略号画在左端，再左右对齐回 ltr；
 * 内层 bdi 隔离，避免斜杠分段在 rtl 上下文里被倒序。
 */
export function FilePathLabel({ path, className }: FilePathLabelProps): JSX.Element {
  return (
    <span
      className={cn('min-w-0 truncate text-left font-mono [direction:rtl]', className)}
      title={path}
    >
      <bdi>{path}</bdi>
    </span>
  )
}
