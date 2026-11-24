import { realpath, stat } from 'node:fs/promises'
import { basename } from 'node:path'
import type { Project } from '@shared/piProtocol'
import { readJsonFile, writeJsonFile } from './settings'

interface ProjectFile {
  projects: Project[]
}

export interface ProjectRegistryOptions {
  filePath: string
  now?: () => number
}

export class ProjectRegistry {
  private projects: Project[] = []
  private loaded = false

  constructor(private options: ProjectRegistryOptions) {}

  private get now(): number {
    return this.options.now?.() ?? Date.now()
  }

  async load(): Promise<void> {
    if (this.loaded) return
    const file = await readJsonFile<ProjectFile>(this.options.filePath, { projects: [] })
    this.projects = file.projects
    this.loaded = true
  }

  async list(): Promise<Project[]> {
    await this.load()
    await this.refresh()
    return this.projects
  }

  async refresh(): Promise<void> {
    await this.load()
    this.projects = await Promise.all(
      this.projects.map(async (project) => ({
        ...project,
        available: await stat(project.path)
          .then((info) => info.isDirectory())
          .catch(() => false)
      }))
    )
  }

  async add(path: string): Promise<Project> {
    await this.load()
    const resolved = await realpath(path).catch(() => null)
    if (!resolved) throw new Error('目录不存在')
    const info = await stat(resolved)
    if (!info.isDirectory()) throw new Error('不是目录')
    const key = normalize(resolved)
    if (this.projects.some((project) => normalize(project.path) === key)) {
      throw new Error('项目已存在')
    }
    const project: Project = {
      id: `p_${this.now}_${Math.random().toString(36).slice(2, 8)}`,
      path: resolved,
      name: basename(resolved),
      addedAt: this.now,
      available: true
    }
    this.projects.push(project)
    await this.save()
    return project
  }

  async remove(id: string): Promise<void> {
    await this.load()
    this.projects = this.projects.filter((project) => project.id !== id)
    await this.save()
  }

  async rename(id: string, name: string): Promise<Project> {
    await this.load()
    const trimmed = name.trim()
    if (!trimmed) throw new Error('名称不能为空')
    const project = this.projects.find((item) => item.id === id)
    if (!project) throw new Error('项目不存在')
    project.name = trimmed
    await this.save()
    return project
  }

  private async save(): Promise<void> {
    await writeJsonFile(this.options.filePath, { projects: this.projects })
  }
}

function normalize(path: string): string {
  const trimmed = path.replace(/[\\/]+$/, '')
  return process.platform === 'darwin' || process.platform === 'win32'
    ? trimmed.toLowerCase()
    : trimmed
}
