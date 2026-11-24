import { serializeJsonLine } from './jsonl'

export interface PiExitInfo {
  code: number | null
  signal: string | null
}

export interface PiTransport {
  writeLine(line: string): Promise<void>
  onLine(listener: (line: string) => void): () => void
  onExit(listener: (info: PiExitInfo) => void): () => void
  stop?(): Promise<void>
  stderrTail?(): string
}

interface Pending {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

export class PiClient {
  private pending = new Map<string, Pending>()
  private requestId = 0
  private recordListeners = new Set<(record: Record<string, unknown>) => void>()
  private protocolErrorListeners = new Set<(message: string) => void>()
  private lastError: Error | null = null

  constructor(
    private transport: PiTransport,
    private timeoutMs = 30_000
  ) {
    transport.onLine((line) => this.handleLine(line))
    transport.onExit((info) => {
      const error = new Error(`pi exited (${info.code ?? info.signal ?? 'unknown'})`)
      this.lastError = error
      this.rejectAll(error)
    })
  }

  onRecord(listener: (record: Record<string, unknown>) => void): () => void {
    this.recordListeners.add(listener)
    return () => this.recordListeners.delete(listener)
  }

  onProtocolError(listener: (message: string) => void): () => void {
    this.protocolErrorListeners.add(listener)
    return () => this.protocolErrorListeners.delete(listener)
  }

  async request<T = unknown>(
    command: Record<string, unknown>,
    timeoutMs = this.timeoutMs
  ): Promise<T> {
    if (this.lastError) throw this.lastError
    const id = `req_${++this.requestId}`
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`pi request timed out: ${String(command.type)}`))
      }, timeoutMs)
      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject, timer })
      void this.transport.writeLine(serializeJsonLine({ ...command, id })).catch((error: Error) => {
        this.settle(id, error)
      })
    })
  }

  respond(record: Record<string, unknown>): void {
    void this.transport.writeLine(serializeJsonLine(record))
  }

  dispose(): void {
    this.recordListeners.clear()
    this.protocolErrorListeners.clear()
    this.rejectAll(new Error('pi client disposed'))
  }

  private settle(id: string, error: Error | null, data?: unknown): void {
    const pending = this.pending.get(id)
    if (!pending) return
    this.pending.delete(id)
    clearTimeout(pending.timer)
    if (error) pending.reject(error)
    else pending.resolve(data)
  }

  private rejectAll(error: Error): void {
    for (const id of [...this.pending.keys()]) this.settle(id, error)
  }

  private handleLine(line: string): void {
    let record: Record<string, unknown>
    try {
      record = JSON.parse(line) as Record<string, unknown>
    } catch {
      for (const listener of this.protocolErrorListeners) listener('invalid JSON line')
      return
    }

    if (record.type === 'response' && typeof record.id === 'string') {
      if (record.success === false) {
        this.settle(record.id, new Error(String(record.error ?? 'pi command failed')))
      } else {
        this.settle(record.id, null, record.data ?? null)
      }
      return
    }

    for (const listener of this.recordListeners) listener(record)
  }
}
