import { describe, expect, it } from 'vitest'
import { isInsideSessionsDir } from './ipcPaths'

const root = '/home/u/.pi/agent/sessions'

describe('isInsideSessionsDir', () => {
  it('accepts jsonl files inside the sessions root', () => {
    expect(isInsideSessionsDir(`${root}/--proj--/a.jsonl`, root)).toBe(true)
  })

  it('rejects non-jsonl files', () => {
    expect(isInsideSessionsDir(`${root}/--proj--/a.txt`, root)).toBe(false)
  })

  it('rejects paths outside the root', () => {
    expect(isInsideSessionsDir('/home/u/.ssh/id_rsa', root)).toBe(false)
  })

  it('rejects traversal escapes', () => {
    expect(isInsideSessionsDir(`${root}/../../../../etc/passwd.jsonl`, root)).toBe(false)
  })

  it('rejects the root itself', () => {
    expect(isInsideSessionsDir(root, root)).toBe(false)
  })
})
