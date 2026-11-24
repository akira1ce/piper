import type { Readable } from 'node:stream'
import { StringDecoder } from 'node:string_decoder'

export interface JsonLineReaderOptions {
  maxLineBytes?: number
  onLine: (line: string) => void
  onOversize: (bytes: number) => void
  onEnd?: () => void
}

/** LF-only framing. Payloads may contain U+2028/U+2029, so never use readline. */
export function createJsonLineReader(stream: Readable, options: JsonLineReaderOptions): () => void {
  const max = options.maxLineBytes ?? 16 * 1024 * 1024
  const decoder = new StringDecoder('utf8')
  let buffer = ''
  let discarding = false

  const emit = (line: string): void => {
    options.onLine(line.endsWith('\r') ? line.slice(0, -1) : line)
  }

  const onData = (chunk: Buffer | string): void => {
    buffer += typeof chunk === 'string' ? chunk : decoder.write(chunk)
    for (;;) {
      const index = buffer.indexOf('\n')
      if (index === -1) break
      const line = buffer.slice(0, index)
      buffer = buffer.slice(index + 1)
      if (discarding) {
        discarding = false
        continue
      }
      if (line.length > max) {
        options.onOversize(line.length)
        continue
      }
      emit(line)
    }
    if (!discarding && buffer.length > max) {
      discarding = true
      options.onOversize(buffer.length)
      buffer = ''
    }
  }

  const onEnd = (): void => {
    buffer += decoder.end()
    if (!discarding && buffer.length > 0) emit(buffer)
    buffer = ''
    options.onEnd?.()
  }

  stream.on('data', onData)
  stream.on('end', onEnd)
  return () => {
    stream.off('data', onData)
    stream.off('end', onEnd)
  }
}

export function serializeJsonLine(value: unknown): string {
  return `${JSON.stringify(value)}\n`
}
