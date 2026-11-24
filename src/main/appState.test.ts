import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { AppStateStore } from './appState'

async function setup(): Promise<{ filePath: string; store: AppStateStore }> {
  const dir = await mkdtemp(join(tmpdir(), 'piper-state-'))
  const filePath = join(dir, 'state.json')
  return { filePath, store: new AppStateStore({ filePath }) }
}

describe('AppStateStore', () => {
  it('returns an empty state on first run', async () => {
    const { store } = await setup()
    expect(await store.get()).toEqual({})
  })

  it('persists the last session across instances', async () => {
    const { filePath, store } = await setup()
    await store.remember('p1', '/tmp/s.jsonl')
    const reopened = new AppStateStore({ filePath })
    expect(await reopened.get()).toEqual({ lastProjectId: 'p1', lastSessionPath: '/tmp/s.jsonl' })
  })

  it('clears the remembered session', async () => {
    const { store } = await setup()
    await store.remember('p1', '/tmp/s.jsonl')
    await store.clear()
    expect(await store.get()).toEqual({})
  })
})
