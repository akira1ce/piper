/**
 * 变更列表默认全部展开，按钮只负责在「全部展开」与「全部收起」之间切换。
 */
export function expandablePaths(paths: string[]): string[] {
  return [...paths]
}

export function toggleAllPaths(paths: string[], openPaths: string[]): string[] {
  const allOpen = paths.length > 0 && paths.every((path) => openPaths.includes(path))
  return allOpen ? [] : [...paths]
}
