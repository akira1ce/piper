/**
 * 长路径优先压缩目录，保留文件名本身可见。
 */
export function splitFilePath(path: string): { dir: string; name: string } {
  const index = path.lastIndexOf('/')
  if (index < 0) return { dir: '', name: path }
  return { dir: path.slice(0, index + 1), name: path.slice(index + 1) }
}
