import type { DomainEvent, PiBatch } from '@shared/piProtocol'

const BOUNDARIES = new Set<DomainEvent['type']>(['message_end', 'settled', 'process_exit'])

export class EventBatcher {
  private events: DomainEvent[] = []
  private timer: ReturnType<typeof setTimeout> | null = null
  private seq = 0

  constructor(
    private intervalMs: number,
    private onFlush: (batch: PiBatch) => void
  ) {}

  push(event: DomainEvent): void {
    this.events.push(event)
    if (BOUNDARIES.has(event.type)) {
      this.flush()
      return
    }
    if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.intervalMs)
    }
  }

  flush(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    if (this.events.length === 0) return
    const events = this.events
    this.events = []
    this.onFlush({ seq: ++this.seq, events })
  }
}
