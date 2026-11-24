import { describe, expect, it } from 'vitest'
import type { PiBatch } from '@shared/piProtocol'
import { PiGateway } from './piGateway'
import type { PiTransport } from './piClient'

interface FakeTransport extends PiTransport {
  emitLine: (line: string) => void
}

function createTransport(): FakeTransport {
  const lineListeners = new Set<(line: string) => void>()
  const exitListeners = new Set<(info: { code: number | null; signal: string | null }) => void>()
  return {
    writeLine: async (line: string) => {
      const record = JSON.parse(line) as Record<string, unknown>
      const reply = JSON.stringify({
        id: record.id,
        type: 'response',
        command: record.type,
        success: true,
        data: { sessionFile: '/tmp/s.jsonl', model: null, thinkingLevel: 'medium' }
      })
      queueMicrotask(() => {
        for (const listener of lineListeners) listener(reply)
      })
    },
    onLine: (listener) => {
      lineListeners.add(listener)
      return () => lineListeners.delete(listener)
    },
    onExit: (listener) => {
      exitListeners.add(listener)
      return () => exitListeners.delete(listener)
    },
    emitLine: (line: string) => {
      for (const listener of lineListeners) listener(line)
    }
  }
}

describe('PiGateway', () => {
  it('starts pi and returns state', async () => {
    const batches: PiBatch[] = []
    const gateway = new PiGateway({
      openProcess: () => createTransport(),
      resolvePi: async () => ({ command: '/bin/pi', version: '1.6.0' }),
      emit: (batch) => batches.push(batch)
    })

    const result = await gateway.handle({ type: 'start', cwd: '/tmp' })
    expect(result.ok).toBe(true)
    if (result.ok) expect((result.data as { version: string }).version).toBe('1.6.0')
    await gateway.handle({ type: 'stop' })
  })

  it('rejects commands when not started', async () => {
    const gateway = new PiGateway({
      openProcess: () => createTransport(),
      resolvePi: async () => ({ command: '/bin/pi', version: '1.6.0' }),
      emit: () => undefined
    })
    const result = await gateway.handle({ type: 'prompt', text: 'hi' })
    expect(result).toEqual({ ok: false, error: 'pi is not running' })
  })

  it('forwards records as batches', async () => {
    const batches: PiBatch[] = []
    const transport = createTransport()
    const gateway = new PiGateway({
      openProcess: () => transport,
      resolvePi: async () => ({ command: '/bin/pi', version: '1.6.0' }),
      emit: (batch) => batches.push(batch),
      intervalMs: 0
    })
    await gateway.handle({ type: 'start', cwd: '/tmp' })
    transport.emitLine(JSON.stringify({ type: 'agent_settled', aborted: false }))
    expect(batches.flatMap((batch) => batch.events).some((event) => event.type === 'settled')).toBe(
      true
    )
    await gateway.handle({ type: 'stop' })
  })
})
