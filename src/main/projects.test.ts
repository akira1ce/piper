import { mkdtemp, readFile, realpath, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ProjectRegistry } from './projects'

async function setup(): Promise<{ dir: string; file: string; registry: ProjectRegistry }> {
  const dir = await mkdtemp(join(tmpdir(), 'piper-projects-'))
  const file = join(dir, 'projects.json')
  return { dir, file, registry: new ProjectRegistry({ filePath: file, now: () => 1000 }) }
}

describe('ProjectRegistry', () => {
  it('adds a project and persists it', async () => {
    const { dir, file, registry } = await setup()
    const project = await registry.add(dir)
    expect(project.path).toBe(await realpath(dir))
    expect(project.name.length).toBeGreaterThan(0)
    const saved = JSON.parse(await readFile(file, 'utf8'))
    expect(saved.projects).toHaveLength(1)
  })

  it('dedupes by real path', async () => {
    const { dir, registry } = await setup()
    await registry.add(dir)
    await expect(registry.add(`${dir}/`)).rejects.toThrow('项目已存在')
    expect(await registry.list()).toHaveLength(1)
  })

  it('rejects missing directories', async () => {
    const { registry } = await setup()
    await expect(registry.add('/definitely/not/here')).rejects.toThrow('目录不存在')
  })

  it('renames without touching disk', async () => {
    const { dir, registry } = await setup()
    const project = await registry.add(dir)
    const renamed = await registry.rename(project.id, '我的项目')
    expect(renamed.name).toBe('我的项目')
  })

  it('removes a project without deleting its folder', async () => {
    const { dir, registry } = await setup()
    const project = await registry.add(dir)
    await registry.remove(project.id)
    expect(await registry.list()).toHaveLength(0)
    const info = await stat(dir)
    expect(info.isDirectory()).toBe(true)
  })
})
