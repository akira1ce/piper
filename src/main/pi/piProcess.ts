import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createJsonLineReader } from './jsonl'

export interface PiProcessOptions {
  command: string
  args: string[]
  cwd: string
  env?: Record<string, string>
}

export interface PiProcessHandlers {
  onStderr?: (chunk: string) => void
  onOversize?: (bytes: number) => void
}

export interface PiExitInfo {
  code: number | null
  signal: string | null
}

const STDERR_LINES = 20
const PENDING_LINES = 1000

export class PiProcess {
  private child: ChildProcessWithoutNullStreams
  private lineListeners = new Set<(line: string) => void>()
  private exitListeners = new Set<(info: PiExitInfo) => void>()
  private exitInfo: PiExitInfo | null = null
  private stderrLines: string[] = []
  private pendingLines: string[] = []
  private stopReader: () => void

  private constructor(child: ChildProcessWithoutNullStreams, handlers: PiProcessHandlers) {
    this.child = child
    if (child.exitCode !== null) this.exitInfo = { code: child.exitCode, signal: null }

    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (text: string) => {
      handlers.onStderr?.(text)
      for (const line of text.split('\n')) {
        if (!line) continue
        this.stderrLines.push(line)
        if (this.stderrLines.length > STDERR_LINES) this.stderrLines.shift()
      }
    })

    child.on('exit', (code, signal) => {
      this.exitInfo = { code, signal }
      for (const listener of [...this.exitListeners]) listener(this.exitInfo)
      this.exitListeners.clear()
    })

    this.stopReader = createJsonLineReader(child.stdout, {
      onLine: (line) => {
        if (this.lineListeners.size === 0) {
          if (this.pendingLines.length < PENDING_LINES) this.pendingLines.push(line)
          return
        }
        for (const listener of [...this.lineListeners]) listener(line)
      },
      onOversize: (bytes) => {
        handlers.onOversize?.(bytes)
        this.stderrLines.push(`[piper] dropped oversized line (${bytes} chars)`)
      }
    })
  }

  static spawn(options: PiProcessOptions, handlers: PiProcessHandlers = {}): PiProcess {
    const child = spawn(options.command, options.args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: ['pipe', 'pipe', 'pipe']
    }) as ChildProcessWithoutNullStreams
    return new PiProcess(child, handlers)
  }

  stderrTail(): string {
    return this.stderrLines.join('\n')
  }

  onLine(listener: (line: string) => void): () => void {
    this.lineListeners.add(listener)
    if (this.pendingLines.length > 0) {
      const pending = this.pendingLines
      this.pendingLines = []
      for (const line of pending) listener(line)
    }
    return () => this.lineListeners.delete(listener)
  }

  writeLine(line: string): Promise<void> {
    const stdin = this.child.stdin
    if (stdin.destroyed || !stdin.writable) {
      return Promise.reject(new Error('pi stdin is not writable'))
    }
    return new Promise((resolve, reject) => {
      stdin.write(line, (error) => (error ? reject(error) : resolve()))
    })
  }

  onExit(listener: (info: PiExitInfo) => void): () => void {
    if (this.exitInfo) {
      listener(this.exitInfo)
      return () => undefined
    }
    this.exitListeners.add(listener)
    return () => this.exitListeners.delete(listener)
  }

  async stop(graceMs = 5000, termMs = 2000): Promise<void> {
    if (this.exitInfo) return
    const exited = new Promise<void>((resolve) => this.onExit(() => resolve()))
    this.child.stdin.end()
    if (await withTimeout(exited, graceMs)) return
    this.child.kill('SIGTERM')
    if (await withTimeout(exited, termMs)) return
    this.child.kill('SIGKILL')
  }

  dispose(): void {
    this.stopReader()
    this.lineListeners.clear()
  }
}

async function withTimeout(promise: Promise<void>, ms: number): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), ms)
  })
  const result = await Promise.race([promise.then(() => true), timeout])
  if (timer) clearTimeout(timer)
  return result
}
