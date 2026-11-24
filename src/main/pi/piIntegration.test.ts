import { accessSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { afterAll, describe, expect, it } from 'vitest'
import { PiClient } from './piClient'
import { PiProcess } from './piProcess'
import { resolvePiPath } from './resolvePi'

const piPath = resolvePiPath({
  env: process.env,
  pathEnv: process.env.PATH ?? '',
  exists: (path) => {
    try {
      accessSync(path)
      return true
    } catch {
      return false
    }
  }
})

describe.skipIf(!piPath)('pi rpc integration', () => {
  const proc = piPath
    ? PiProcess.spawn({
        command: piPath,
        args: ['--mode', 'rpc', '--no-session'],
        cwd: tmpdir()
      })
    : null

  afterAll(async () => {
    await proc?.stop()
  })

  it('answers get_state on a real pi process', async () => {
    const client = new PiClient(proc!)
    const state = await client.request<{ sessionId?: string; isStreaming?: boolean }>(
      { type: 'get_state' },
      15_000
    )
    expect(state.isStreaming).toBe(false)
    expect(typeof state.sessionId).toBe('string')
  }, 20_000)
})
