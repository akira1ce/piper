import { describe, expect, it } from 'vitest'
import { PiProcess } from './piProcess'

const echoScript = `
let buf = ''
process.stdin.on('data', (chunk) => {
  buf += chunk.toString()
  for (;;) {
    const i = buf.indexOf('\\n')
    if (i === -1) break
    const line = buf.slice(0, i)
    buf = buf.slice(i + 1)
    const value = JSON.parse(line)
    process.stdout.write(JSON.stringify({ echo: value }) + '\\n')
  }
})
`

function nodeProcess(script: string): PiProcess {
  return PiProcess.spawn(
    { command: process.execPath, args: ['-e', script], cwd: process.cwd() },
    { onStderr: () => {} }
  )
}

describe('PiProcess', () => {
  it('writes JSONL and surfaces parsed lines', async () => {
    const lines: string[] = []
    const proc = PiProcess.spawn(
      { command: process.execPath, args: ['-e', echoScript], cwd: process.cwd() },
      { onStderr: () => {} }
    )
    proc.onLine((line) => lines.push(line))
    await proc.writeLine('{"id":"1","type":"ping"}\n')
    await new Promise((resolve) => setTimeout(resolve, 200))
    expect(lines.length).toBe(1)
    expect(JSON.parse(lines[0])).toEqual({ echo: { id: '1', type: 'ping' } })
    await proc.stop()
  })

  it('reports the exit code', async () => {
    const info = await new Promise<{ code: number | null }>((resolve) => {
      const proc = nodeProcess(`process.stdout.write('{"x":1}\\n'); process.exit(3)`)
      proc.onExit((value) => resolve(value))
    })
    expect(info.code).toBe(3)
  })

  it('keeps a bounded stderr tail', async () => {
    const proc = nodeProcess(`process.stderr.write('a\\nb\\nc\\n'); setTimeout(() => {}, 500)`)
    await new Promise((resolve) => setTimeout(resolve, 150))
    expect(proc.stderrTail().split('\n')).toHaveLength(3)
    await proc.stop()
  })
})
