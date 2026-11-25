export interface FileNode {
  name: string
  path: string
  isFile: boolean
  children: FileNode[]
}

export function buildTree(paths: string[]): FileNode[] {
  const root: FileNode = { name: '', path: '', isFile: false, children: [] }

  for (const path of paths) {
    if (!path) continue
    const parts = path.split('/')
    let node = root
    parts.forEach((part, index) => {
      const isFile = index === parts.length - 1
      let next = node.children.find((child) => child.name === part && child.isFile === isFile)
      if (!next) {
        next = { name: part, path: parts.slice(0, index + 1).join('/'), isFile, children: [] }
        node.children.push(next)
      }
      node = next
    })
  }

  sortTree(root)
  return root.children
}

function sortTree(node: FileNode): void {
  node.children.sort((a, b) => {
    if (a.isFile !== b.isFile) return a.isFile ? 1 : -1
    return a.name.localeCompare(b.name)
  })
  for (const child of node.children) sortTree(child)
}
