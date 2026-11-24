import { afterEach, describe, expect, it, vi } from 'vitest'
import { PiClient, type PiTransport } from './piClient'

class FakeTransport implements PiTransport {
  written: string[] = []
  private lineListeners = new Set<(line: string) => void>()
  private exitListeners = new Set<(info: { code: number | null; signal: string | null }) => void>()
  constructor(private respond: (record: Record<string, unknown>) => string | null) {}

  writeLine(line: string): Promise<void> {
    this.written.push(line)
    const record = JSON.parse(line)
    const reply = this.respond(record)
    if (reply) queueMicrotask(() => this.emitLine(reply))
    return Promise.resolve()
  }

  onLine(listener: (line: string) => void): () => void {
    this.lineListeners.add(listener)
    return () => this.lineListeners.delete(listener)
  }

  onExit(listener: (info: { code: number | null; signal: string | null }) => void): () => void {
    this.exitListeners.add(listener)
    return () => this.exitListeners.delete(listener)
  }

  emitLine(line: string): void {
    for (const listener of this.lineListeners) listener(line)
  }

  emitExit(code: number | null): void {
    for (const listener of this.exitListeners) listener({ code, signal: null })
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('PiClient', () => {
  it('correlates responses by id', async () => {
    const transport = new FakeTransport((record) =>
      JSON.stringify({
        id: record.id,
        type: 'response',
        command: record.type,
        success: true,
        data: { ok: 1 }
      })
    )
    const client = new PiClient(transport)
    await expect(client.request({ type: 'get_state' })).resolves.toEqual({ ok: 1 })
    expect(JSON.parse(transport.written[0]).type).toBe('get_state')
  })

  it('rejects on failure responses', async () => {
    const transport = new FakeTransport((record) =>
      JSON.stringify({
        id: record.id,
        type: 'response',
        command: record.type,
        success: false,
        error: 'nope'
      })
    )
    const client = new PiClient(transport)
    await expect(client.request({ type: 'get_state' })).rejects.toThrow('nope')
  })

  it('times out pending requests', async () => {
    vi.useFakeTimers()
    const transport = new FakeTransport(() => null)
    const client = new PiClient(transport, 1000)
    const promise = client.request({ type: 'get_state' })
    vi.advanceTimersByTime(1000)
    await expect(promise).rejects.toThrow('timed out')
  })

  it('rejects pending requests on exit', async () => {
    const transport = new FakeTransport(() => null)
    const client = new PiClient(transport)
    const promise = client.request({ type: 'get_state' })
    transport.emitExit(1)
    await expect(promise).rejects.toThrow('pi exited')
  })

  it('ignores malformed lines and emits protocol_error', () => {
    const transport = new FakeTransport(() => null)
    const client = new PiClient(transport)
    const errors: string[] = []
    client.onProtocolError((message) => errors.push(message))
    transport.emitLine('not json')
    expect(errors).toHaveLength(1)
  })
})
