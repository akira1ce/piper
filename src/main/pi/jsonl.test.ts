import { Readable } from 'node:stream'
import { describe, expect, it } from 'vitest'
import { createJsonLineReader } from './jsonl'

interface Collected {
  lines: string[]
  oversize: number[]
}

function read(chunks: Array<string | Buffer>, maxLineBytes = 1024): Promise<Collected> {
  const lines: string[] = []
  const oversize: number[] = []
  const stream = Readable.from(chunks.map((c) => (typeof c === 'string' ? Buffer.from(c) : c)))
  return new Promise((resolve) => {
    createJsonLineReader(stream, {
      maxLineBytes,
      onLine: (line) => lines.push(line),
      onOversize: (bytes) => oversize.push(bytes),
      onEnd: () => resolve({ lines, oversize })
    })
  })
}

describe('createJsonLineReader', () => {
  it('splits multiple lines in one chunk', async () => {
    const { lines } = await read(['{"a":1}\n{"b":2}\n'])
    expect(lines).toEqual(['{"a":1}', '{"b":2}'])
  })

  it('keeps a partial line across chunks and flushes it at end', async () => {
    const { lines } = await read(['{"a":', '1}\n{"b":'])
    expect(lines).toEqual(['{"a":1}', '{"b":'])
  })

  it('flushes the trailing line without newline on end', async () => {
    const { lines } = await read(['{"a":1}'])
    expect(lines).toEqual(['{"a":1}'])
  })

  it('strips a trailing carriage return', async () => {
    const { lines } = await read(['{"a":1}\r\n'])
    expect(lines).toEqual(['{"a":1}'])
  })

  it('does not split on U+2028 inside a JSON string', async () => {
    const payload = JSON.stringify({ text: `a\u2028b` })
    const { lines } = await read([`${payload}\n`])
    expect(lines).toEqual([payload])
  })

  it('decodes multi-byte characters split across chunks', async () => {
    const bytes = Buffer.from('{"t":"中"}\n')
    const { lines } = await read([bytes.subarray(0, 7), bytes.subarray(7)])
    expect(lines).toEqual(['{"t":"中"}'])
  })

  it('drops oversized lines and recovers on the next line', async () => {
    const { lines, oversize } = await read(['x'.repeat(50), '\n{"ok":1}\n'], 10)
    expect(oversize.length).toBe(1)
    expect(lines).toEqual(['{"ok":1}'])
  })
})
