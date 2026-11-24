import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DomainEvent, PiBatch } from '@shared/piProtocol'
import { EventBatcher } from './eventBatcher'

afterEach(() => {
  vi.useRealTimers()
})

function collect(): { batches: PiBatch[]; batcher: EventBatcher } {
  const batches: PiBatch[] = []
  const batcher = new EventBatcher(30, (batch) => batches.push(batch))
  return { batches, batcher }
}

const text = (value: string): DomainEvent => ({
  type: 'delta',
  kind: 'text',
  contentIndex: 0,
  text: value
})

describe('EventBatcher', () => {
  it('merges deltas within the window', () => {
    vi.useFakeTimers()
    const { batches, batcher } = collect()
    batcher.push(text('a'))
    batcher.push(text('b'))
    expect(batches).toHaveLength(0)
    vi.advanceTimersByTime(30)
    expect(batches).toHaveLength(1)
    expect(batches[0].events).toHaveLength(2)
    expect(batches[0].seq).toBe(1)
  })

  it('flushes immediately on semantic boundaries', () => {
    vi.useFakeTimers()
    const { batches, batcher } = collect()
    batcher.push(text('a'))
    batcher.push({ type: 'settled', aborted: false })
    expect(batches).toHaveLength(1)
    expect(batches[0].events.map((event) => event.type)).toEqual(['delta', 'settled'])
  })

  it('keeps seq monotonic', () => {
    vi.useFakeTimers()
    const { batches, batcher } = collect()
    batcher.push(text('a'))
    batcher.push({ type: 'agent_start' })
    batcher.flush()
    batcher.push(text('b'))
    batcher.flush()
    expect(batches.map((batch) => batch.seq)).toEqual([1, 2])
  })
})
