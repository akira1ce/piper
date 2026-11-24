import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SessionIndex, resolveSessionsDir } from './sessionIndex'

const header = (cwd: string, id = 's1'): string =>
  JSON.stringify({
    type: 'session',
    version: 3,
    id,
    cwd,
    timestamp: '2026-01-01T00:00:00.000Z'
  })

const userMessage = (text: string): string =>
  JSON.stringify({
    type: 'message',
    id: 'e1',
    parentId: null,
    timestamp: '2026-01-01T00:00:01.000Z',
    message: { role: 'user', content: text, timestamp: 1 }
  })

describe('resolveSessionsDir', () => {
  it('prefers PI_CODING_AGENT_SESSION_DIR', () => {
    expect(resolveSessionsDir({ PI_CODING_AGENT_SESSION_DIR: '/custom' }, '/home/u')).toBe(
      '/custom'
    )
  })

  it('defaults to ~/.pi/agent/sessions', () => {
    expect(resolveSessionsDir({}, '/home/u')).toBe('/home/u/.pi/agent/sessions')
  })
})

describe('SessionIndex', () => {
  it('summarises sessions with name, cwd and first message', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'piper-sessions-'))
    const group = join(dir, '--tmp-proj--')
    await mkdir(group, { recursive: true })
    await writeFile(
      join(group, 'a_s1.jsonl'),
      [
        header('/tmp/proj'),
        JSON.stringify({
          type: 'session_info',
          id: 'n1',
          parentId: null,
          timestamp: '2026-01-01T00:00:02.000Z',
          name: '重构 RPC'
        }),
        userMessage('帮我重构客户端')
      ].join('\n') + '\n'
    )
    await writeFile(
      join(group, 'b_s2.jsonl'),
      [header('/tmp/proj', 's2'), userMessage('第二个会话')].join('\n') + '\n'
    )

    const index = new SessionIndex({ sessionsDir: dir })
    const sessions = await index.list()
    expect(sessions).toHaveLength(2)
    const named = sessions.find((session) => session.name === '重构 RPC')
    expect(named).toMatchObject({
      cwd: '/tmp/proj',
      messageCount: 1,
      firstMessage: '帮我重构客户端'
    })
    expect(sessions.some((session) => session.firstMessage === '第二个会话')).toBe(true)
  })

  it('skips corrupt lines and files without a header', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'piper-sessions-'))
    const group = join(dir, '--tmp-x--')
    await mkdir(group, { recursive: true })
    await writeFile(join(group, 'broken.jsonl'), '{not json}\n')
    await writeFile(join(group, 'good.jsonl'), `${header('/tmp/x')}\n${userMessage('hi')}\n`)
    const sessions = await new SessionIndex({ sessionsDir: dir }).list()
    expect(sessions.map((session) => session.cwd)).toEqual(['/tmp/x'])
  })
})
