# Piper M1–M2（网关 + 项目/会话）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 打通 `renderer ↔ main ↔ pi --mode rpc` 的完整链路，并让左侧"项目 → 会话"两级导航可用。

**Architecture:** 主进程用自研薄客户端（严格 LF 分帧 + id 关联 + 事件批处理）驱动 pi 子进程；只把领域事件推给渲染进程；会话列表只读解析 `~/.pi/agent/sessions`，项目注册表存 `userData/projects.json`；渲染进程用纯 reducer 把领域事件变成页面视图。

**Tech Stack:** Electron 44、React 19、Tailwind 4、Radix、zustand 5、vitest 5、TypeScript 5.9。

**Spec:** `docs/superpowers/specs/2026-11-24-piper-v1-design.md`

## Global Constraints

- 包管理器 `yarn`；验证命令：`yarn typecheck`、`yarn test`、`yarn build`。
- 不引入 pi SDK（`@earendil-works/pi-coding-agent`）作为运行时依赖；pi 使用系统安装版本，最低 `1.6.0`。
- 只用系统安装的 `pi`；`PIPER_PI_PATH` 优先。
- 主进程是唯一碰 `fs` / `child_process` / `dialog` 的地方；渲染进程只能通过 `window.api.pi` 交互。
- 渲染进程命令白名单见 spec §6；新增命令必须同时改 `src/shared/piProtocol.ts`、`src/main/ipc.ts`、`src/preload/index.ts`。
- 颜色只用 `theme/tokens.css` 的语义 token；`pages/` 下禁止 shadcn 变量名。
- 文件名/slug 不用短横线；组件 `PascalCase.tsx`，其余 `camelCase.ts`。
- 事件批处理 30ms；`message_end` / `settled` / `process_exit` 立即 flush。
- 单行 JSONL 上限 16MB；禁止 `node:readline`。
- v1 只允许一个活跃 pi 进程。

---

## 文件结构

```
src/shared/piProtocol.ts                    共享类型 + 常量
src/main/pi/jsonl.ts                        严格 LF 分帧
src/main/pi/piProcess.ts                    子进程：写入/背压/stderr ring/停止
src/main/pi/resolvePi.ts                    pi 路径解析 + 版本比较
src/main/pi/piClient.ts                     id 关联 / 超时 / 退出清理
src/main/pi/mapRecord.ts                    RPC 记录 → DomainEvent
src/main/pi/eventBatcher.ts                 30ms 合并 + seq
src/main/pi/piGateway.ts                    单连接 + 命令路由
src/main/pi/sessionIndex.ts                 会话 JSONL 只读索引
src/main/projects.ts                        项目注册表（projects.json）
src/main/settings.ts                        userData JSON 读写（原子写）
src/main/ipc.ts                             命令白名单 + 校验 + 广播
src/main/index.ts                           窗口 + 注册 IPC
src/preload/index.ts                        contextBridge
src/renderer/src/pages/home/
├── controller/reducePiEvent.ts             领域事件 → 视图（纯函数）
├── controller/usePiBridge.ts               订阅事件 + 派发 store
├── store/chat.ts                           会话视图
├── store/projects.ts                       项目/会话列表
└── components/Sider/{index,ProjectGroup,SessionItem}.tsx
```

---

### Task 1: vitest 基座 + 共享协议类型 + `@shared` 别名

**Files:**

- Modify: `package.json`（加 `vitest`、`test` 脚本）
- Create: `vitest.config.ts`
- Create: `src/shared/piProtocol.ts`
- Create: `src/shared/piProtocol.test.ts`
- Modify: `electron.vite.config.ts:1-20`
- Modify: `tsconfig.node.json`、`tsconfig.web.json`

**Interfaces:**

- Produces: `ThinkingLevel`、`ModelInfo`、`SessionSummary`、`Project`、`DomainEvent`、`PiCommand`、`PiResult`、`PiBatch`、`PiBridge`、`THINKING_LEVELS`
- Produces: 所有包可用的 `@shared/*` 别名

- [ ] **Step 1: 安装与配置 vitest**

```bash
yarn add -D vitest@^5.1.1
```

`package.json` 的 `scripts` 增加：

```json
"test": "vitest run",
"test:watch": "vitest"
```

`vitest.config.ts`：

```ts
import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve('src/shared')
    }
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node'
  }
})
```

- [ ] **Step 2: 写 `src/shared/piProtocol.ts`**

```ts
export const THINKING_LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const
export type ThinkingLevel = (typeof THINKING_LEVELS)[number]

export interface ModelInfo {
  provider: string
  id: string
  contextWindow: number
  reasoning: boolean
}

export interface SessionSummary {
  path: string
  id: string
  cwd: string
  name?: string
  modified: number
  messageCount: number
  firstMessage: string
}

export interface Project {
  id: string
  path: string
  name: string
  addedAt: number
  available: boolean
}

export interface ToolCallView {
  toolCallId: string
  toolName: string
  args: unknown
  state: 'pending' | 'running' | 'done' | 'error'
  preview: string
  durationMs?: number
}

export interface MessageBlock {
  kind: 'text' | 'thinking' | 'tool'
  text?: string
  streaming?: boolean
  toolCallId?: string
}

export interface MessageView {
  id: string
  role: 'user' | 'assistant'
  blocks: MessageBlock[]
}

export interface ExtensionUiRequest {
  id: string
  method: 'select' | 'confirm' | 'input' | 'editor' | 'notify' | 'setStatus' | 'setTitle'
  title?: string
  message?: string
  options?: string[]
  prefill?: string
  timeout?: number
  notifyType?: 'info' | 'warning' | 'error'
}

export type DomainEvent =
  | { type: 'agent_start' }
  | { type: 'turn_start' }
  | { type: 'agent_end'; willRetry: boolean }
  | { type: 'settled'; aborted: boolean }
  | { type: 'message_start'; message: unknown }
  | { type: 'message_end'; message: unknown }
  | {
      type: 'delta'
      kind: 'text' | 'thinking' | 'toolcall'
      contentIndex: number
      text?: string
      toolCallId?: string
      toolName?: string
    }
  | {
      type: 'block_end'
      kind: 'text' | 'thinking' | 'toolcall'
      contentIndex: number
      content: string
      toolCall?: unknown
    }
  | { type: 'tool_start'; toolCallId: string; toolName: string; args: unknown }
  | { type: 'tool_update'; toolCallId: string; partialResult: unknown }
  | {
      type: 'tool_end'
      toolCallId: string
      result: unknown
      isError: boolean
      durationMs?: number
    }
  | { type: 'queue'; steering: string[]; followUp: string[] }
  | { type: 'thinking_changed'; level: ThinkingLevel }
  | { type: 'session_info'; name?: string }
  | {
      type: 'compaction'
      phase: 'start' | 'end'
      reason?: string
      aborted?: boolean
      willRetry?: boolean
    }
  | { type: 'retry'; phase: 'start' | 'end'; attempt?: number; success?: boolean; message?: string }
  | { type: 'extension_ui'; request: ExtensionUiRequest }
  | { type: 'extension_error'; message: string }
  | { type: 'protocol_error'; message: string }
  | { type: 'process_exit'; code: number | null; signal: string | null; stderrTail: string }

export type PiCommand =
  | { type: 'start'; cwd: string; sessionPath?: string }
  | { type: 'stop' }
  | { type: 'prompt'; text: string; behavior?: 'steer' | 'followUp' }
  | { type: 'abort' }
  | { type: 'clearQueue' }
  | { type: 'state' }
  | { type: 'messages' }
  | { type: 'models' }
  | { type: 'setModel'; provider: string; modelId: string }
  | { type: 'thinkingLevels' }
  | { type: 'setThinkingLevel'; level: ThinkingLevel }
  | { type: 'stats' }
  | { type: 'newSession' }
  | { type: 'switchSession'; sessionPath: string }
  | { type: 'renameSession'; name: string }
  | { type: 'sessions'; projectId: string }
  | { type: 'projects' }
  | { type: 'addProject' }
  | { type: 'removeProject'; projectId: string }
  | { type: 'renameProject'; projectId: string; name: string }
  | { type: 'pickDirectory' }
  | {
      type: 'extensionRespond'
      id: string
      value?: string
      confirmed?: boolean
      cancelled?: boolean
    }

export type PiResult<T = unknown> = { ok: true; data: T } | { ok: false; error: string }

export interface PiBatch {
  seq: number
  events: DomainEvent[]
}

export interface PiBridge {
  invoke(command: PiCommand): Promise<PiResult>
  onEvent(listener: (batch: PiBatch) => void): () => void
}
```

- [ ] **Step 3: 写失败测试 `src/shared/piProtocol.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { THINKING_LEVELS, type ThinkingLevel } from '@shared/piProtocol'

describe('piProtocol', () => {
  it('exposes every thinking level once', () => {
    expect(THINKING_LEVELS).toEqual(['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'])
    expect(new Set(THINKING_LEVELS).size).toBe(THINKING_LEVELS.length)
  })

  it('narrows thinking level type', () => {
    const level: ThinkingLevel = 'medium'
    expect(THINKING_LEVELS).toContain(level)
  })
})
```

- [ ] **Step 4: 配置别名并跑测试**

`electron.vite.config.ts`：

```ts
import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const shared = resolve('src/shared')

export default defineConfig({
  main: { resolve: { alias: { '@shared': shared } } },
  preload: { resolve: { alias: { '@shared': shared } } },
  renderer: {
    resolve: { alias: { '@renderer': resolve('src/renderer/src'), '@shared': shared } },
    plugins: [react(), tailwindcss()]
  }
})
```

`tsconfig.node.json` 的 `include` 追加 `"src/shared/**/*"` 和 `"vitest.config.ts"`，`compilerOptions.paths` 增加：

```json
"baseUrl": ".",
"paths": { "@shared/*": ["src/shared/*"] }
```

`tsconfig.web.json` 的 `include` 追加 `"src/shared/**/*"`，`paths` 增加 `"@shared/*": ["src/shared/*"]`。

Run: `yarn test`
Expected: PASS（2 个用例）

- [ ] **Step 5: 提交**

```bash
git add package.json yarn.lock vitest.config.ts src/shared electron.vite.config.ts tsconfig.node.json tsconfig.web.json
git commit -m "chore: add vitest and shared protocol types"
```

---

### Task 2: 严格 JSONL 分帧

**Files:**

- Create: `src/main/pi/jsonl.ts`
- Test: `src/main/pi/jsonl.test.ts`

**Interfaces:**

- Produces: `createJsonLineReader(stream, options): () => void`、`serializeJsonLine(value): string`
- Produces: `JsonLineReaderOptions { maxLineBytes?, onLine, onOversize, onEnd? }`

- [ ] **Step 1: 写失败测试**

```ts
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

  it('keeps a partial line across chunks and flushes at end', async () => {
    const { lines } = await read(['{"a":', '1}\n{"b":'])
    expect(lines).toEqual(['{"a":1}'])
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
```

- [ ] **Step 2: 跑测试确认失败**

Run: `yarn test src/main/pi/jsonl.test.ts`
Expected: FAIL（`Cannot find module './jsonl'`）

- [ ] **Step 3: 实现 `src/main/pi/jsonl.ts`**

```ts
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
```

- [ ] **Step 4: 跑测试确认通过**

Run: `yarn test src/main/pi/jsonl.test.ts`
Expected: PASS（7 个用例）

- [ ] **Step 5: 提交**

```bash
git add src/main/pi/jsonl.ts src/main/pi/jsonl.test.ts
git commit -m "feat(pi): strict LF-only JSONL framing"
```

---

### Task 3: PiProcess（spawn / 写入 / stderr / 停止）

**Files:**

- Create: `src/main/pi/piProcess.ts`
- Test: `src/main/pi/piProcess.test.ts`

**Interfaces:**

- Consumes: `createJsonLineReader`
- Produces: `PiProcess.spawn(options, handlers?): PiProcess`
- Produces: `PiProcess` 直接实现 `PiTransport`：`writeLine(line)`、`onLine(cb)`、`onExit(cb)`、`stderrTail()`
- Produces: `PiProcessOptions { command, args, cwd, env? }`、`PiProcessHandlers { onStderr?, onOversize? }`

`PiProcess` 在构造时就挂好分帧器；首个 `onLine` 订阅者出现前的行先放进缓冲，避免与 `PiClient` 构造之间的竞态。

- [ ] **Step 1: 写失败测试（用 `node -e` 做假 pi，不需要真实 pi）**

```ts
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
    { onLine: () => {}, onStderr: () => {} }
  )
}

describe('PiProcess', () => {
  it('writes JSONL and surfaces parsed lines', async () => {
    const lines: string[] = []
    const proc = PiProcess.spawn(
      { command: process.execPath, args: ['-e', echoScript], cwd: process.cwd() },
      { onLine: (line) => lines.push(line), onStderr: () => {} }
    )
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
    expect(proc.stderrTail.split('\n')).toHaveLength(3)
    await proc.stop()
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `yarn test src/main/pi/piProcess.test.ts`
Expected: FAIL（`Cannot find module './piProcess'`）

- [ ] **Step 3: 实现 `src/main/pi/piProcess.ts`**

```ts
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createJsonLineReader } from './jsonl'

export interface PiProcessOptions {
  command: string
  args: string[]
  cwd: string
  env?: Record<string, string>
}

export interface PiProcessHandlers {
  onStderr?: (chunk: string) => void
  onOversize?: (bytes: number) => void
}

export interface PiExitInfo {
  code: number | null
  signal: string | null
}

const STDERR_LINES = 20
const PENDING_LINES = 1000

export class PiProcess {
  private child: ChildProcessWithoutNullStreams
  private lineListeners = new Set<(line: string) => void>()
  private exitListeners = new Set<(info: PiExitInfo) => void>()
  private exitInfo: PiExitInfo | null = null
  private stderrLines: string[] = []
  private pendingLines: string[] = []
  private stopReader: () => void

  private constructor(child: ChildProcessWithoutNullStreams, handlers: PiProcessHandlers) {
    this.child = child
    if (child.exitCode !== null) this.exitInfo = { code: child.exitCode, signal: null }

    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (text: string) => {
      handlers.onStderr?.(text)
      for (const line of text.split('\n')) {
        if (!line) continue
        this.stderrLines.push(line)
        if (this.stderrLines.length > STDERR_LINES) this.stderrLines.shift()
      }
    })

    child.on('exit', (code, signal) => {
      this.exitInfo = { code, signal }
      for (const listener of [...this.exitListeners]) listener(this.exitInfo)
      this.exitListeners.clear()
    })

    this.stopReader = createJsonLineReader(child.stdout, {
      onLine: (line) => {
        if (this.lineListeners.size === 0) {
          if (this.pendingLines.length < PENDING_LINES) this.pendingLines.push(line)
          return
        }
        for (const listener of [...this.lineListeners]) listener(line)
      },
      onOversize: (bytes) => {
        handlers.onOversize?.(bytes)
        this.stderrLines.push(`[piper] dropped oversized line (${bytes} chars)`)
      }
    })
  }

  static spawn(options: PiProcessOptions, handlers: PiProcessHandlers = {}): PiProcess {
    const child = spawn(options.command, options.args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: ['pipe', 'pipe', 'pipe']
    }) as ChildProcessWithoutNullStreams
    return new PiProcess(child, handlers)
  }

  stderrTail(): string {
    return this.stderrLines.join('\n')
  }

  onLine(listener: (line: string) => void): () => void {
    this.lineListeners.add(listener)
    if (this.pendingLines.length > 0) {
      const pending = this.pendingLines
      this.pendingLines = []
      for (const line of pending) listener(line)
    }
    return () => this.lineListeners.delete(listener)
  }

  writeLine(line: string): Promise<void> {
    const stdin = this.child.stdin
    if (stdin.destroyed || !stdin.writable) {
      return Promise.reject(new Error('pi stdin is not writable'))
    }
    return new Promise((resolve, reject) => {
      stdin.write(line, (error) => (error ? reject(error) : resolve()))
    })
  }

  onExit(listener: (info: PiExitInfo) => void): () => void {
    if (this.exitInfo) {
      listener(this.exitInfo)
      return () => undefined
    }
    this.exitListeners.add(listener)
    return () => this.exitListeners.delete(listener)
  }

  async stop(graceMs = 5000, termMs = 2000): Promise<void> {
    if (this.exitInfo) return
    const exited = new Promise<void>((resolve) => this.onExit(() => resolve()))
    this.child.stdin.end()
    if (await withTimeout(exited, graceMs)) return
    this.child.kill('SIGTERM')
    if (await withTimeout(exited, termMs)) return
    this.child.kill('SIGKILL')
  }

  dispose(): void {
    this.stopReader()
    this.lineListeners.clear()
  }
}

async function withTimeout(promise: Promise<void>, ms: number): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), ms)
  })
  const result = await Promise.race([promise.then(() => true), timeout])
  if (timer) clearTimeout(timer)
  return result
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `yarn test src/main/pi/piProcess.test.ts`
Expected: PASS（3 个用例）

- [ ] **Step 5: 提交**

```bash
git add src/main/pi/piProcess.ts src/main/pi/piProcess.test.ts
git commit -m "feat(pi): child process runner with bounded stderr"
```

---

### Task 4: pi 可执行文件解析与版本检查

**Files:**

- Create: `src/main/pi/resolvePi.ts`
- Test: `src/main/pi/resolvePi.test.ts`

**Interfaces:**

- Produces: `resolvePiPath({ env, pathEnv, exists, platform? }): string | null`
- Produces: `compareVersion(a, b): number`、`isVersionSupported(version, minimum?): boolean`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, it } from 'vitest'
import { compareVersion, isVersionSupported, resolvePiPath } from './resolvePi'

const posix = (files: string[], existing: string[]) => ({
  env: {},
  pathEnv: files.map((f) => `/bin:${f}`).join(':'),
  exists: (p: string) => existing.includes(p),
  platform: 'darwin' as const
})

describe('resolvePiPath', () => {
  it('prefers PIPER_PI_PATH', () => {
    expect(
      resolvePiPath({
        env: { PIPER_PI_PATH: '/custom/pi' },
        pathEnv: '/usr/bin',
        exists: (p) => p === '/custom/pi',
        platform: 'darwin'
      })
    ).toBe('/custom/pi')
  })

  it('falls back to PATH', () => {
    expect(
      resolvePiPath({
        env: {},
        pathEnv: '/opt/homebrew/bin:/usr/bin',
        exists: (p) => p === '/opt/homebrew/bin/pi',
        platform: 'darwin'
      })
    ).toBe('/opt/homebrew/bin/pi')
  })

  it('returns null when nothing is found', () => {
    expect(
      resolvePiPath({ env: {}, pathEnv: '/usr/bin', exists: () => false, platform: 'linux' })
    ).toBeNull()
  })

  it('uses pi.cmd on win32', () => {
    expect(
      resolvePiPath({
        env: {},
        pathEnv: 'C:\\tools',
        exists: (p) => p.toLowerCase().endsWith('pi.cmd'),
        platform: 'win32'
      })
    ).not.toBeNull()
  })
})

describe('versions', () => {
  it('compares dotted versions', () => {
    expect(compareVersion('1.6.0', '1.5.9')).toBeGreaterThan(0)
    expect(compareVersion('1.6.0', '1.6.0')).toBe(0)
    expect(compareVersion('1.6', '1.6.0')).toBe(0)
  })

  it('checks the minimum', () => {
    expect(isVersionSupported('1.6.0')).toBe(true)
    expect(isVersionSupported('2.0.1')).toBe(true)
    expect(isVersionSupported('1.5.9')).toBe(false)
    expect(isVersionSupported('invalid')).toBe(false)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `yarn test src/main/pi/resolvePi.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 `src/main/pi/resolvePi.ts`**

```ts
export interface ResolveOptions {
  env: Record<string, string | undefined>
  pathEnv: string
  exists: (path: string) => boolean
  platform?: NodeJS.Platform
}

export function resolvePiPath(options: ResolveOptions): string | null {
  const override = options.env.PIPER_PI_PATH
  if (override && options.exists(override)) return override

  const platform = options.platform ?? process.platform
  const name = platform === 'win32' ? 'pi.cmd' : 'pi'
  const separator = platform === 'win32' ? ';' : ':'
  for (const dir of options.pathEnv.split(separator)) {
    if (!dir) continue
    const candidate = `${dir.replace(/[\\/]$/, '')}/${name}`
    if (options.exists(candidate)) return candidate
  }
  return null
}

export function compareVersion(a: string, b: string): number {
  const left = a.split('.').map((part) => Number.parseInt(part, 10))
  const right = b.split('.').map((part) => Number.parseInt(part, 10))
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const l = Number.isNaN(left[i]) ? 0 : (left[i] ?? 0)
    const r = Number.isNaN(right[i]) ? 0 : (right[i] ?? 0)
    if (l !== r) return l - r
  }
  return 0
}

export function isVersionSupported(version: string, minimum = '1.6.0'): boolean {
  if (!/^\d+(\.\d+){0,2}/.test(version)) return false
  return compareVersion(version, minimum) >= 0
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `yarn test src/main/pi/resolvePi.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/main/pi/resolvePi.ts src/main/pi/resolvePi.test.ts
git commit -m "feat(pi): resolve pi binary and check version"
```

---

### Task 5: PiClient（id 关联 / 超时 / 退出清理）

**Files:**

- Create: `src/main/pi/piClient.ts`
- Test: `src/main/pi/piClient.test.ts`

**Interfaces:**

- Consumes: `serializeJsonLine`
- Produces: `PiTransport { writeLine, onLine, onExit }`
- Produces: `PiClient` 的 `request<T>(command): Promise<T>`、`respond(record): void`、`onRecord(listener): () => void`、`dispose(): void`
- Produces: `PiTransport` 可选 `stderrTail?(): string`

- [ ] **Step 1: 写失败测试**

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PiClient, type PiTransport } from './piClient'

class FakeTransport implements PiTransport {
  written: string[] = []
  private lineListeners = new Set<(line: string) => void>()
  private exitListeners = new Set<(info: { code: number | null; signal: string | null }) => void>()
  constructor(private respond: (record: Record<string, unknown>) => string | null) {}

  writeLine(line: string): Promise<void> {
    this.written.push(line)
    const record = JSON.parse(line)
    const reply = this.respond(record)
    if (reply) queueMicrotask(() => this.emitLine(reply))
    return Promise.resolve()
  }

  onLine(listener: (line: string) => void): () => void {
    this.lineListeners.add(listener)
    return () => this.lineListeners.delete(listener)
  }

  onExit(listener: (info: { code: number | null; signal: string | null }) => void): () => void {
    this.exitListeners.add(listener)
    return () => this.exitListeners.delete(listener)
  }

  emitLine(line: string): void {
    for (const listener of this.lineListeners) listener(line)
  }

  emitExit(code: number | null): void {
    for (const listener of this.exitListeners) listener({ code, signal: null })
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('PiClient', () => {
  it('correlates responses by id', async () => {
    const transport = new FakeTransport((record) =>
      JSON.stringify({
        id: record.id,
        type: 'response',
        command: record.type,
        success: true,
        data: { ok: 1 }
      })
    )
    const client = new PiClient(transport)
    await expect(client.request({ type: 'get_state' })).resolves.toEqual({ ok: 1 })
    expect(JSON.parse(transport.written[0]).type).toBe('get_state')
  })

  it('rejects on failure responses', async () => {
    const transport = new FakeTransport((record) =>
      JSON.stringify({
        id: record.id,
        type: 'response',
        command: record.type,
        success: false,
        error: 'nope'
      })
    )
    const client = new PiClient(transport)
    await expect(client.request({ type: 'get_state' })).rejects.toThrow('nope')
  })

  it('times out pending requests', async () => {
    vi.useFakeTimers()
    const transport = new FakeTransport(() => null)
    const client = new PiClient(transport, 1000)
    const promise = client.request({ type: 'get_state' })
    vi.advanceTimersByTime(1000)
    await expect(promise).rejects.toThrow('timed out')
  })

  it('rejects pending requests on exit', async () => {
    const transport = new FakeTransport(() => null)
    const client = new PiClient(transport)
    const promise = client.request({ type: 'get_state' })
    transport.emitExit(1)
    await expect(promise).rejects.toThrow('pi exited')
  })

  it('ignores malformed lines and emits protocol_error', () => {
    const transport = new FakeTransport(() => null)
    const client = new PiClient(transport)
    const errors: string[] = []
    client.onProtocolError((message) => errors.push(message))
    transport.emitLine('not json')
    expect(errors).toHaveLength(1)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `yarn test src/main/pi/piClient.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 `src/main/pi/piClient.ts`**

```ts
import { serializeJsonLine } from './jsonl'

export interface PiExitInfo {
  code: number | null
  signal: string | null
}

export interface PiTransport {
  writeLine(line: string): Promise<void>
  onLine(listener: (line: string) => void): () => void
  onExit(listener: (info: PiExitInfo) => void): () => void
  stop?(): Promise<void>
  stderrTail?(): string
}

interface Pending {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

export class PiClient {
  private pending = new Map<string, Pending>()
  private requestId = 0
  private recordListeners = new Set<(record: Record<string, unknown>) => void>()
  private protocolErrorListeners = new Set<(message: string) => void>()
  private lastError: Error | null = null

  constructor(
    private transport: PiTransport,
    private timeoutMs = 30_000
  ) {
    transport.onLine((line) => this.handleLine(line))
    transport.onExit((info) => {
      const error = new Error(`pi exited (${info.code ?? info.signal ?? 'unknown'})`)
      this.lastError = error
      this.rejectAll(error)
    })
  }

  onRecord(listener: (record: Record<string, unknown>) => void): () => void {
    this.recordListeners.add(listener)
    return () => this.recordListeners.delete(listener)
  }

  onProtocolError(listener: (message: string) => void): () => void {
    this.protocolErrorListeners.add(listener)
    return () => this.protocolErrorListeners.delete(listener)
  }

  async request<T = unknown>(
    command: Record<string, unknown>,
    timeoutMs = this.timeoutMs
  ): Promise<T> {
    if (this.lastError) throw this.lastError
    const id = `req_${++this.requestId}`
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`pi request timed out: ${String(command.type)}`))
      }, timeoutMs)
      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject, timer })
      void this.transport.writeLine(serializeJsonLine({ ...command, id })).catch((error: Error) => {
        this.settle(id, error)
      })
    })
  }

  respond(record: Record<string, unknown>): void {
    void this.transport.writeLine(serializeJsonLine(record))
  }

  dispose(): void {
    this.recordListeners.clear()
    this.protocolErrorListeners.clear()
    this.rejectAll(new Error('pi client disposed'))
  }

  private settle(id: string, error: Error | null, data?: unknown): void {
    const pending = this.pending.get(id)
    if (!pending) return
    this.pending.delete(id)
    clearTimeout(pending.timer)
    if (error) pending.reject(error)
    else pending.resolve(data)
  }

  private rejectAll(error: Error): void {
    for (const id of [...this.pending.keys()]) this.settle(id, error)
  }

  private handleLine(line: string): void {
    let record: Record<string, unknown>
    try {
      record = JSON.parse(line) as Record<string, unknown>
    } catch {
      for (const listener of this.protocolErrorListeners) listener('invalid JSON line')
      return
    }

    if (record.type === 'response' && typeof record.id === 'string') {
      if (record.success === false) {
        this.settle(record.id, new Error(String(record.error ?? 'pi command failed')))
      } else {
        this.settle(record.id, null, record.data ?? null)
      }
      return
    }

    for (const listener of this.recordListeners) listener(record)
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `yarn test src/main/pi/piClient.test.ts`
Expected: PASS（5 个用例）

- [ ] **Step 5: 提交**

```bash
git add src/main/pi/piClient.ts src/main/pi/piClient.test.ts
git commit -m "feat(pi): rpc client with id correlation and timeouts"
```

---

### Task 6: RPC 记录映射 + 事件批处理

**Files:**

- Create: `src/main/pi/mapRecord.ts`
- Test: `src/main/pi/mapRecord.test.ts`
- Create: `src/main/pi/eventBatcher.ts`
- Test: `src/main/pi/eventBatcher.test.ts`

**Interfaces:**

- Consumes: `DomainEvent`、`PiBatch`
- Produces: `mapRecord(record): DomainEvent[]`
- Produces: `EventBatcher(intervalMs, onFlush)`，方法 `push(event)`、`flush()`

- [ ] **Step 1: 写失败的映射测试**

```ts
import { describe, expect, it } from 'vitest'
import { mapRecord } from './mapRecord'

describe('mapRecord', () => {
  it('maps text deltas and authoritative block ends', () => {
    expect(
      mapRecord({
        type: 'message_update',
        assistantMessageEvent: { type: 'text_delta', contentIndex: 0, delta: 'hi' }
      })
    ).toEqual([{ type: 'delta', kind: 'text', contentIndex: 0, text: 'hi' }])
    expect(
      mapRecord({
        type: 'message_update',
        assistantMessageEvent: { type: 'text_end', contentIndex: 0, content: 'hi' }
      })
    ).toEqual([{ type: 'block_end', kind: 'text', contentIndex: 0, content: 'hi' }])
  })

  it('maps thinking and toolcall deltas', () => {
    expect(
      mapRecord({
        type: 'message_update',
        assistantMessageEvent: { type: 'thinking_delta', contentIndex: 1, delta: 'hm' }
      })
    ).toEqual([{ type: 'delta', kind: 'thinking', contentIndex: 1, text: 'hm' }])
    expect(
      mapRecord({
        type: 'message_update',
        assistantMessageEvent: {
          type: 'toolcall_start',
          contentIndex: 2,
          id: 'call_1',
          toolName: 'bash'
        }
      })
    ).toEqual([
      { type: 'delta', kind: 'toolcall', contentIndex: 2, toolCallId: 'call_1', toolName: 'bash' }
    ])
  })

  it('maps tool execution lifecycle', () => {
    expect(
      mapRecord({
        type: 'tool_execution_start',
        toolCallId: 'c1',
        toolName: 'bash',
        args: { command: 'ls' }
      })
    ).toEqual([{ type: 'tool_start', toolCallId: 'c1', toolName: 'bash', args: { command: 'ls' } }])
    expect(
      mapRecord({ type: 'tool_execution_update', toolCallId: 'c1', partialResult: { content: [] } })
    ).toEqual([{ type: 'tool_update', toolCallId: 'c1', partialResult: { content: [] } }])
    expect(
      mapRecord({
        type: 'tool_execution_end',
        toolCallId: 'c1',
        result: { content: [] },
        isError: false,
        durationMs: 12
      })
    ).toEqual([
      {
        type: 'tool_end',
        toolCallId: 'c1',
        result: { content: [] },
        isError: false,
        durationMs: 12
      }
    ])
  })

  it('maps run boundaries, queue and extension UI', () => {
    expect(mapRecord({ type: 'agent_settled', aborted: true })).toEqual([
      { type: 'settled', aborted: true }
    ])
    expect(mapRecord({ type: 'agent_end', messages: [], willRetry: true })).toEqual([
      { type: 'agent_end', willRetry: true }
    ])
    expect(mapRecord({ type: 'queue_update', steering: ['a'], followUp: [] })).toEqual([
      { type: 'queue', steering: ['a'], followUp: [] }
    ])
    expect(
      mapRecord({
        type: 'extension_ui_request',
        id: 'd1',
        method: 'confirm',
        title: 'ok?',
        message: 'sure'
      })
    ).toEqual([
      {
        type: 'extension_ui',
        request: { id: 'd1', method: 'confirm', title: 'ok?', message: 'sure' }
      }
    ])
  })

  it('ignores unknown records', () => {
    expect(mapRecord({ type: 'something_else' })).toEqual([])
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `yarn test src/main/pi/mapRecord.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现 `src/main/pi/mapRecord.ts`**

```ts
import type { DomainEvent, ExtensionUiRequest, ThinkingLevel } from '@shared/piProtocol'

type Record_ = Record<string, any>

export function mapRecord(record: Record_): DomainEvent[] {
  switch (record.type) {
    case 'agent_start':
      return [{ type: 'agent_start' }]
    case 'turn_start':
      return [{ type: 'turn_start' }]
    case 'agent_end':
      return [{ type: 'agent_end', willRetry: Boolean(record.willRetry) }]
    case 'agent_settled':
      return [{ type: 'settled', aborted: Boolean(record.aborted) }]
    case 'message_start':
      return [{ type: 'message_start', message: record.message }]
    case 'message_end':
      return [{ type: 'message_end', message: record.message }]
    case 'message_update':
      return mapUpdate(record.assistantMessageEvent)
    case 'tool_execution_start':
      return [
        {
          type: 'tool_start',
          toolCallId: record.toolCallId,
          toolName: record.toolName,
          args: record.args
        }
      ]
    case 'tool_execution_update':
      return [
        { type: 'tool_update', toolCallId: record.toolCallId, partialResult: record.partialResult }
      ]
    case 'tool_execution_end':
      return [
        {
          type: 'tool_end',
          toolCallId: record.toolCallId,
          result: record.result,
          isError: Boolean(record.isError),
          durationMs: record.durationMs
        }
      ]
    case 'queue_update':
      return [{ type: 'queue', steering: record.steering ?? [], followUp: record.followUp ?? [] }]
    case 'thinking_level_changed':
      return [{ type: 'thinking_changed', level: record.level as ThinkingLevel }]
    case 'session_info_changed':
      return [{ type: 'session_info', name: record.name ?? undefined }]
    case 'compaction_start':
      return [{ type: 'compaction', phase: 'start', reason: record.reason }]
    case 'compaction_end':
      return [
        {
          type: 'compaction',
          phase: 'end',
          reason: record.reason,
          aborted: Boolean(record.aborted),
          willRetry: Boolean(record.willRetry)
        }
      ]
    case 'auto_retry_start':
      return [
        { type: 'retry', phase: 'start', attempt: record.attempt, message: record.errorMessage }
      ]
    case 'auto_retry_end':
      return [
        {
          type: 'retry',
          phase: 'end',
          success: Boolean(record.success),
          message: record.finalError
        }
      ]
    case 'extension_ui_request':
      return [{ type: 'extension_ui', request: toExtensionUiRequest(record) }]
    case 'extension_error':
      return [{ type: 'extension_error', message: String(record.error ?? 'extension error') }]
    default:
      return []
  }
}

function mapUpdate(update: Record_ | undefined): DomainEvent[] {
  if (!update) return []
  switch (update.type) {
    case 'text_delta':
      return [
        { type: 'delta', kind: 'text', contentIndex: update.contentIndex, text: update.delta }
      ]
    case 'thinking_delta':
      return [
        { type: 'delta', kind: 'thinking', contentIndex: update.contentIndex, text: update.delta }
      ]
    case 'toolcall_start':
      return [
        {
          type: 'delta',
          kind: 'toolcall',
          contentIndex: update.contentIndex,
          toolCallId: update.id,
          toolName: update.toolName
        }
      ]
    case 'toolcall_delta':
      return [
        { type: 'delta', kind: 'toolcall', contentIndex: update.contentIndex, text: update.delta }
      ]
    case 'text_end':
    case 'thinking_end':
      return [
        {
          type: 'block_end',
          kind: update.type === 'text_end' ? 'text' : 'thinking',
          contentIndex: update.contentIndex,
          content: update.content
        }
      ]
    case 'toolcall_end':
      return [
        {
          type: 'block_end',
          kind: 'toolcall',
          contentIndex: update.contentIndex,
          content: '',
          toolCall: update.toolCall
        }
      ]
    default:
      return []
  }
}

function toExtensionUiRequest(record: Record_): ExtensionUiRequest {
  return {
    id: record.id,
    method: record.method,
    title: record.title,
    message: record.message,
    options: record.options,
    prefill: record.prefill,
    timeout: record.timeout,
    notifyType: record.notifyType
  }
}
```

- [ ] **Step 4: 写失败的批处理测试**

```ts
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
    expect(batches[0].events.map((e) => e.type)).toEqual(['delta', 'settled'])
  })

  it('keeps seq monotonic', () => {
    vi.useFakeTimers()
    const { batches, batcher } = collect()
    batcher.push(text('a'))
    batcher.push({ type: 'agent_start' })
    batcher.flush()
    batcher.push(text('b'))
    batcher.flush()
    expect(batches.map((b) => b.seq)).toEqual([1, 2])
  })
})
```

Run: `yarn test src/main/pi/eventBatcher.test.ts`
Expected: FAIL

- [ ] **Step 5: 实现 `src/main/pi/eventBatcher.ts` 并跑通**

```ts
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
```

Run: `yarn test src/main/pi/`
Expected: PASS（含前序任务的全部用例）

- [ ] **Step 6: 提交**

```bash
git add src/main/pi/mapRecord.ts src/main/pi/mapRecord.test.ts src/main/pi/eventBatcher.ts src/main/pi/eventBatcher.test.ts
git commit -m "feat(pi): map rpc records and batch domain events"
```

---

### Task 7: PiGateway（单连接 + 命令路由）

**Files:**

- Create: `src/main/pi/piGateway.ts`
- Test: `src/main/pi/piGateway.test.ts`

**Interfaces:**

- Consumes: `PiClient`、`PiProcess`、`mapRecord`、`EventBatcher`、`resolvePiPath`
- Produces: `PiGateway` 的 `handle(command: PiCommand): Promise<PiResult>`
- Produces: `PiGatewayDeps { openProcess(options): PiTransport; resolvePi(): Promise<{ command; version; warning? }>; emit(batch); intervalMs? }`

- [ ] **Step 1: 写失败测试（注入假 transport，不启动真实 pi）**

```ts
import { describe, expect, it } from 'vitest'
import type { PiBatch, PiResult } from '@shared/piProtocol'
import { PiGateway } from './piGateway'
import type { PiTransport } from './piClient'

function createTransport(): PiTransport & { emitLine: (line: string) => void } {
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
    expect(batches.flatMap((b) => b.events).some((e) => e.type === 'settled')).toBe(true)
    await gateway.handle({ type: 'stop' })
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `yarn test src/main/pi/piGateway.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现 `src/main/pi/piGateway.ts`**

```ts
import type {
  ModelInfo,
  PiBatch,
  PiCommand,
  PiResult,
  SessionSummary,
  ThinkingLevel
} from '@shared/piProtocol'
import { EventBatcher } from './eventBatcher'
import { mapRecord } from './mapRecord'
import { PiClient, type PiTransport } from './piClient'

export interface ResolvedPi {
  command: string
  version: string
  warning?: string
}

export interface PiGatewayDeps {
  openProcess: (options: { command: string; args: string[]; cwd: string }) => PiTransport
  resolvePi: () => Promise<ResolvedPi>
  emit: (batch: PiBatch) => void
  intervalMs?: number
}

export class PiGateway {
  private client: PiClient | null = null
  private transport: PiTransport | null = null
  private batcher: EventBatcher
  private models: ModelInfo[] = []
  private sessionFile: string | null = null
  private cwd: string | null = null

  constructor(private deps: PiGatewayDeps) {
    this.batcher = new EventBatcher(deps.intervalMs ?? 30, deps.emit)
  }

  async handle(command: PiCommand): Promise<PiResult> {
    try {
      return { ok: true, data: await this.route(command) }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  }

  private async route(command: PiCommand): Promise<unknown> {
    switch (command.type) {
      case 'start':
        return this.start(command.cwd, command.sessionPath)
      case 'stop':
        return this.stop()
      case 'models':
        this.requireClient()
        return { models: this.models }
      case 'state': {
        const client = this.requireClient()
        return client.request({ type: 'get_state' })
      }
      case 'prompt': {
        const client = this.requireClient()
        return client.request({
          type: 'prompt',
          message: command.text,
          ...(command.behavior ? { streamingBehavior: command.behavior } : {})
        })
      }
      case 'abort':
        return this.requireClient().request({ type: 'abort' })
      case 'clearQueue':
        return this.requireClient().request({ type: 'clear_queue' })
      case 'messages':
        return this.requireClient().request({ type: 'get_messages' })
      case 'stats':
        return this.requireClient().request({ type: 'get_session_stats' })
      case 'thinkingLevels':
        return this.requireClient().request({ type: 'get_available_thinking_levels' })
      case 'setThinkingLevel':
        return this.requireClient().request({ type: 'set_thinking_level', level: command.level })
      case 'setModel':
        return this.requireClient().request({
          type: 'set_model',
          provider: command.provider,
          modelId: command.modelId
        })
      case 'newSession':
        return this.requireClient().request({ type: 'new_session' })
      case 'switchSession':
        return this.requireClient().request({
          type: 'switch_session',
          sessionPath: command.sessionPath
        })
      case 'renameSession':
        return this.requireClient().request({ type: 'set_session_name', name: command.name })
      case 'extensionRespond':
        return this.requireClient().respond({
          type: 'extension_ui_response',
          id: command.id,
          ...(command.value !== undefined ? { value: command.value } : {}),
          ...(command.confirmed !== undefined ? { confirmed: command.confirmed } : {}),
          ...(command.cancelled ? { cancelled: true } : {})
        })
      case 'sessions':
      case 'projects':
      case 'addProject':
      case 'removeProject':
      case 'renameProject':
      case 'pickDirectory':
        throw new Error(`command ${command.type} is handled by ipc.ts`)
      default:
        throw new Error('unsupported command')
    }
  }

  private async start(cwd: string, sessionPath?: string): Promise<ResolvedPi & { state: unknown }> {
    await this.stop()
    const resolved = await this.deps.resolvePi()
    const transport = this.deps.openProcess({
      command: resolved.command,
      args: ['--mode', 'rpc', ...(sessionPath ? ['--session', sessionPath] : [])],
      cwd
    })
    const client = new PiClient(transport)
    client.onRecord((record) => {
      for (const event of mapRecord(record)) this.batcher.push(event)
    })
    client.onProtocolError((message) => this.batcher.push({ type: 'protocol_error', message }))
    transport.onExit((info) => {
      this.client = null
      this.transport = null
      this.batcher.push({
        type: 'process_exit',
        code: info.code,
        signal: info.signal,
        stderrTail: transport.stderrTail?.() ?? ''
      })
      this.batcher.flush()
    })

    this.client = client
    this.transport = transport
    this.cwd = cwd
    const state = (await client.request({ type: 'get_state' })) as { sessionFile?: string }
    this.sessionFile = state.sessionFile ?? sessionPath ?? null
    const models = (await client.request({ type: 'get_available_models' })) as {
      models: ModelInfo[]
    }
    this.models = models.models
    return { ...resolved, state }
  }

  private async stop(): Promise<void> {
    const client = this.client
    const transport = this.transport
    this.client = null
    this.transport = null
    this.sessionFile = null
    if (client) {
      try {
        await client.request({ type: 'abort' }, 3000)
      } catch {
        // 进程可能已经退出
      }
      client.dispose()
    }
    await transport?.stop?.()
  }

  private requireClient(): PiClient {
    if (!this.client) throw new Error('pi is not running')
    return this.client
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `yarn test src/main/pi/piGateway.test.ts`
Expected: PASS（3 个用例）

- [ ] **Step 5: 提交**

```bash
git add src/main/pi/piGateway.ts src/main/pi/piGateway.test.ts src/main/pi/piClient.ts
git commit -m "feat(pi): gateway with single active connection"
```

---

### Task 8: 会话索引（只读 JSONL）

**Files:**

- Create: `src/main/pi/sessionIndex.ts`
- Test: `src/main/pi/sessionIndex.test.ts`

**Interfaces:**

- Consumes: `SessionSummary`
- Produces: `SessionIndex.list(): Promise<SessionSummary[]>`
- Produces: `resolveSessionsDir(env, homedir): string`

- [ ] **Step 1: 写失败测试（临时目录 + fixture 文件）**

```ts
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SessionIndex, resolveSessionsDir } from './sessionIndex'

const header = (cwd: string, id = 's1') =>
  JSON.stringify({ type: 'session', version: 3, id, cwd, timestamp: '2026-01-01T00:00:00.000Z' })

const userMessage = (text: string) =>
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
    expect(sessions.some((s) => s.firstMessage === '第二个会话')).toBe(true)
  })

  it('skips corrupt lines and files without a header', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'piper-sessions-'))
    const group = join(dir, '--tmp-x--')
    await mkdir(group, { recursive: true })
    await writeFile(join(group, 'broken.jsonl'), '{not json}\n')
    await writeFile(join(group, 'good.jsonl'), `${header('/tmp/x')}\n${userMessage('hi')}\n`)
    const sessions = await new SessionIndex({ sessionsDir: dir }).list()
    expect(sessions.map((s) => s.cwd)).toEqual(['/tmp/x'])
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `yarn test src/main/pi/sessionIndex.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现 `src/main/pi/sessionIndex.ts`**

```ts
import { readdir, readFile, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { SessionSummary } from '@shared/piProtocol'

export function resolveSessionsDir(
  env: Record<string, string | undefined>,
  home = homedir()
): string {
  return env.PI_CODING_AGENT_SESSION_DIR ?? join(home, '.pi', 'agent', 'sessions')
}

interface SessionIndexOptions {
  sessionsDir: string
  concurrency?: number
}

const cache = new Map<string, { mtime: number; size: number; summary: SessionSummary | null }>()

export class SessionIndex {
  constructor(private options: SessionIndexOptions) {}

  async list(): Promise<SessionSummary[]> {
    const groups = await readdir(this.options.sessionsDir, { withFileTypes: true }).catch(() => [])
    const files: string[] = []
    for (const group of groups) {
      if (!group.isDirectory() || !group.name.startsWith('--')) continue
      const entries = await readdir(join(this.options.sessionsDir, group.name), {
        withFileTypes: true
      })
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.jsonl')) {
          files.push(join(this.options.sessionsDir, group.name, entry.name))
        }
      }
    }

    const summaries: SessionSummary[] = []
    const limit = this.options.concurrency ?? 8
    for (let i = 0; i < files.length; i += limit) {
      const batch = await Promise.all(
        files.slice(i, i + limit).map((file) => this.readSummary(file))
      )
      for (const summary of batch) if (summary) summaries.push(summary)
    }
    return summaries.sort((a, b) => b.modified - a.modified)
  }

  private async readSummary(path: string): Promise<SessionSummary | null> {
    const info = await stat(path).catch(() => null)
    if (!info) return null
    const cached = cache.get(path)
    if (cached && cached.mtime === info.mtimeMs && cached.size === info.size) return cached.summary

    const text = await readFile(path, 'utf8').catch(() => '')
    const lines = text.split('\n')
    let header: { type?: string; id?: string; cwd?: string; version?: number } | null = null
    let name: string | undefined
    let firstMessage = ''
    let messageCount = 0

    for (const line of lines) {
      if (!line) continue
      let entry: any
      try {
        entry = JSON.parse(line)
      } catch {
        continue
      }
      if (!header) {
        if (entry.type !== 'session') return this.remember(path, info.mtimeMs, info.size, null)
        header = entry
        continue
      }
      if (entry.type === 'message') messageCount += 1
      if (entry.type === 'session_info' && typeof entry.name === 'string') name = entry.name
      if (!firstMessage && entry.type === 'message' && entry.message?.role === 'user') {
        firstMessage = toText(entry.message.content).slice(0, 120)
      }
    }

    if (!header || typeof header.id !== 'string' || typeof header.cwd !== 'string') {
      return this.remember(path, info.mtimeMs, info.size, null)
    }

    const summary: SessionSummary = {
      path,
      id: header.id,
      cwd: header.cwd,
      name,
      modified: info.mtimeMs,
      messageCount,
      firstMessage
    }
    return this.remember(path, info.mtimeMs, info.size, summary)
  }

  private remember(
    path: string,
    mtime: number,
    size: number,
    summary: SessionSummary | null
  ): SessionSummary | null {
    cache.set(path, { mtime, size, summary })
    return summary
  }
}

function toText(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((block: any) => (typeof block?.text === 'string' ? block.text : ''))
      .filter(Boolean)
      .join(' ')
  }
  return ''
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `yarn test src/main/pi/sessionIndex.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/main/pi/sessionIndex.ts src/main/pi/sessionIndex.test.ts
git commit -m "feat(pi): read-only session index"
```

---

### Task 9: 项目注册表

**Files:**

- Create: `src/main/settings.ts`
- Create: `src/main/projects.ts`
- Test: `src/main/projects.test.ts`

**Interfaces:**

- Consumes: `Project`
- Produces: `readJsonFile<T>(path, fallback)`、`writeJsonFile(path, value)`
- Produces: `ProjectRegistry` 的 `list()`、`add(path)`、`remove(id)`、`rename(id, name)`、`refresh()`

- [ ] **Step 1: 写失败测试**

```ts
import { mkdir, mkdtemp, readFile, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ProjectRegistry } from './projects'

async function setup(): Promise<{ dir: string; file: string; registry: ProjectRegistry }> {
  const dir = await mkdtemp(join(tmpdir(), 'piper-projects-'))
  const file = join(dir, 'projects.json')
  return { dir, file, registry: new ProjectRegistry({ filePath: file, now: () => 1000 }) }
}

describe('ProjectRegistry', () => {
  it('adds a project and persists it', async () => {
    const { dir, file, registry } = await setup()
    const project = await registry.add(dir)
    expect(project.path).toBe(dir)
    expect(project.name.length).toBeGreaterThan(0)
    const saved = JSON.parse(await readFile(file, 'utf8'))
    expect(saved.projects).toHaveLength(1)
  })

  it('dedupes by real path', async () => {
    const { dir, registry } = await setup()
    await registry.add(dir)
    await expect(registry.add(`${dir}/`)).rejects.toThrow('项目已存在')
    expect(await registry.list()).toHaveLength(1)
  })

  it('rejects missing directories', async () => {
    const { registry } = await setup()
    await expect(registry.add('/definitely/not/here')).rejects.toThrow('目录不存在')
  })

  it('renames without touching disk', async () => {
    const { dir, registry } = await setup()
    const project = await registry.add(dir)
    const renamed = await registry.rename(project.id, '我的项目')
    expect(renamed.name).toBe('我的项目')
  })

  it('removes a project without deleting its folder', async () => {
    const { dir, registry } = await setup()
    const project = await registry.add(dir)
    await registry.remove(project.id)
    expect(await registry.list()).toHaveLength(0)
    const info = await stat(dir)
    expect(info.isDirectory()).toBe(true)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `yarn test src/main/projects.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现 `src/main/settings.ts`**

```ts
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export async function readJsonFile<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T
  } catch {
    return fallback
  }
}

export async function writeJsonFile(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`)
  await rename(tmp, path)
}
```

- [ ] **Step 4: 实现 `src/main/projects.ts`**

```ts
import { realpath, stat } from 'node:fs/promises'
import { basename } from 'node:path'
import type { Project } from '@shared/piProtocol'
import { readJsonFile, writeJsonFile } from './settings'

interface ProjectFile {
  projects: Project[]
}

export interface ProjectRegistryOptions {
  filePath: string
  now?: () => number
}

export class ProjectRegistry {
  private projects: Project[] = []
  private loaded = false

  constructor(private options: ProjectRegistryOptions) {}

  private get now(): number {
    return this.options.now?.() ?? Date.now()
  }

  async load(): Promise<void> {
    if (this.loaded) return
    const file = await readJsonFile<ProjectFile>(this.options.filePath, { projects: [] })
    this.projects = file.projects
    this.loaded = true
  }

  async list(): Promise<Project[]> {
    await this.load()
    await this.refresh()
    return this.projects
  }

  async refresh(): Promise<void> {
    await this.load()
    const next = await Promise.all(
      this.projects.map(async (project) => ({
        ...project,
        available: await stat(project.path)
          .then((s) => s.isDirectory())
          .catch(() => false)
      }))
    )
    this.projects = next
  }

  async add(path: string): Promise<Project> {
    await this.load()
    const resolved = await realpath(path).catch(() => null)
    if (!resolved) throw new Error('目录不存在')
    const info = await stat(resolved)
    if (!info.isDirectory()) throw new Error('不是目录')
    const key = normalize(resolved)
    if (this.projects.some((p) => normalize(p.path) === key)) {
      throw new Error('项目已存在')
    }
    const project: Project = {
      id: `p_${this.now}_${Math.random().toString(36).slice(2, 8)}`,
      path: resolved,
      name: basename(resolved),
      addedAt: this.now,
      available: true
    }
    this.projects.push(project)
    await this.save()
    return project
  }

  async remove(id: string): Promise<void> {
    await this.load()
    this.projects = this.projects.filter((p) => p.id !== id)
    await this.save()
  }

  async rename(id: string, name: string): Promise<Project> {
    await this.load()
    const trimmed = name.trim()
    if (!trimmed) throw new Error('名称不能为空')
    const project = this.projects.find((p) => p.id === id)
    if (!project) throw new Error('项目不存在')
    project.name = trimmed
    await this.save()
    return project
  }

  private async save(): Promise<void> {
    await writeJsonFile(this.options.filePath, { projects: this.projects })
  }
}

function normalize(path: string): string {
  const trimmed = path.replace(/[\\/]+$/, '')
  return process.platform === 'darwin' || process.platform === 'win32'
    ? trimmed.toLowerCase()
    : trimmed
}
```

- [ ] **Step 5: 跑测试确认通过并提交**

Run: `yarn test src/main/projects.test.ts`
Expected: PASS

```bash
git add src/main/settings.ts src/main/projects.ts src/main/projects.test.ts
git commit -m "feat: project registry with atomic persistence"
```

---

### Task 10: 渲染进程状态 + 事件归一化

**Files:**

- Create: `src/renderer/src/pages/home/controller/reducePiEvent.ts`
- Test: `src/renderer/src/pages/home/controller/reducePiEvent.test.ts`
- Create: `src/renderer/src/pages/home/store/chat.ts`
- Modify: `src/renderer/src/pages/home/store/ui.ts`（保留 UI 折叠状态）

**Interfaces:**

- Consumes: `DomainEvent`、`PiBatch`、`MessageView`、`ToolCallView`
- Produces: `initialChatView(): ChatView`、`reduceBatch(view, batch): ChatView`
- Produces: `useChatStore`、`chatActions.reset()`、`chatActions.apply(batch)`

- [ ] **Step 1: 写失败测试（纯 reducer）**

```ts
import { describe, expect, it } from 'vitest'
import type { PiBatch } from '@shared/piProtocol'
import { initialChatView, reduceBatch } from './reducePiEvent'

const batch = (events: PiBatch['events'], seq = 1): PiBatch => ({ seq, events })

describe('reduceBatch', () => {
  it('appends text deltas to the streaming assistant message', () => {
    let view = initialChatView()
    view = reduceBatch(
      view,
      batch([
        { type: 'message_start', message: { role: 'assistant', content: [], id: 'm1' } },
        { type: 'delta', kind: 'text', contentIndex: 0, text: 'hel' },
        { type: 'delta', kind: 'text', contentIndex: 0, text: 'lo' }
      ])
    )
    expect(view.messages[0].blocks[0]).toMatchObject({
      kind: 'text',
      text: 'hello',
      streaming: true
    })
  })

  it('replaces streamed text with authoritative content', () => {
    let view = initialChatView()
    view = reduceBatch(
      view,
      batch([
        { type: 'message_start', message: { role: 'assistant', content: [], id: 'm1' } },
        { type: 'delta', kind: 'text', contentIndex: 0, text: 'he' },
        { type: 'block_end', kind: 'text', contentIndex: 0, content: 'hello world' }
      ])
    )
    expect(view.messages[0].blocks[0]).toMatchObject({ text: 'hello world', streaming: false })
  })

  it('tracks tool lifecycle by toolCallId', () => {
    let view = initialChatView()
    view = reduceBatch(
      view,
      batch([
        { type: 'tool_start', toolCallId: 'c1', toolName: 'bash', args: { command: 'ls' } },
        { type: 'tool_end', toolCallId: 'c1', result: {}, isError: false, durationMs: 12 }
      ])
    )
    expect(view.toolCalls.c1).toMatchObject({ state: 'done', durationMs: 12 })
  })

  it('goes idle only on settled', () => {
    let view = initialChatView()
    view = reduceBatch(view, batch([{ type: 'agent_start' }]))
    expect(view.status).toBe('running')
    view = reduceBatch(view, batch([{ type: 'agent_end', willRetry: false }]), 2)
    expect(view.status).toBe('running')
    view = reduceBatch(view, batch([{ type: 'settled', aborted: false }]), 3)
    expect(view.status).toBe('idle')
  })

  it('rejects stale batches', () => {
    let view = initialChatView()
    view = reduceBatch(view, batch([{ type: 'agent_start' }], 5))
    const next = reduceBatch(view, batch([{ type: 'settled', aborted: false }], 4))
    expect(next).toBe(view)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `yarn test src/renderer/src/pages/home/controller/reducePiEvent.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现 reducer**

```ts
import type {
  DomainEvent,
  MessageBlock,
  MessageView,
  PiBatch,
  ThinkingLevel,
  ToolCallView
} from '@shared/piProtocol'

export interface ChatView {
  status: 'idle' | 'running' | 'compacting' | 'reconnecting' | 'error'
  lastSeq: number
  sessionPath: string | null
  thinkingLevel: ThinkingLevel
  messages: MessageView[]
  toolCalls: Record<string, ToolCallView>
  queue: { steering: string[]; followUp: string[] }
  banner: { kind: 'error' | 'info'; text: string } | null
}

export function initialChatView(): ChatView {
  return {
    status: 'idle',
    lastSeq: 0,
    sessionPath: null,
    thinkingLevel: 'off',
    messages: [],
    toolCalls: {},
    queue: { steering: [], followUp: [] },
    banner: null
  }
}

export function reduceBatch(view: ChatView, batch: PiBatch): ChatView {
  if (batch.seq <= view.lastSeq) return view
  const next: ChatView = {
    ...view,
    lastSeq: batch.seq,
    messages: view.messages.map((message) => ({
      ...message,
      blocks: message.blocks.map((block) => ({ ...block }))
    })),
    toolCalls: { ...view.toolCalls }
  }
  for (const event of batch.events) applyEvent(next, event)
  return next
}

function applyEvent(view: ChatView, event: DomainEvent): void {
  switch (event.type) {
    case 'agent_start':
    case 'turn_start':
      view.status = 'running'
      return
    case 'agent_end':
      view.status = event.willRetry ? 'running' : view.status
      return
    case 'settled':
      view.status = 'idle'
      for (const [id, tool] of Object.entries(view.toolCalls)) {
        if (tool.state === 'running' || tool.state === 'pending') {
          view.toolCalls[id] = { ...tool, state: 'done' }
        }
      }
      return
    case 'message_start':
      view.messages.push(toMessageView(event.message))
      return
    case 'delta':
      applyDelta(view, event)
      return
    case 'block_end':
      applyBlockEnd(view, event)
      return
    case 'tool_start':
      view.toolCalls[event.toolCallId] = {
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        args: event.args,
        state: 'running',
        preview: ''
      }
      return
    case 'tool_update':
      const tool = view.toolCalls[event.toolCallId]
      if (tool) {
        view.toolCalls[event.toolCallId] = {
          ...tool,
          preview: toText(event.partialResult).slice(0, 400)
        }
      }
      return
    case 'tool_end':
      const done = view.toolCalls[event.toolCallId]
      if (done) {
        view.toolCalls[event.toolCallId] = {
          ...done,
          state: event.isError ? 'error' : 'done',
          durationMs: event.durationMs,
          preview: toText(event.result).slice(0, 400)
        }
      }
      return
    case 'queue':
      view.queue = { steering: event.steering, followUp: event.followUp }
      return
    case 'thinking_changed':
      view.thinkingLevel = event.level
      return
    case 'compaction':
      view.status = event.phase === 'start' ? 'compacting' : 'running'
      return
    case 'retry':
      view.banner =
        event.phase === 'start'
          ? { kind: 'info', text: `重试中（第 ${event.attempt ?? 1} 次）` }
          : event.success
            ? null
            : { kind: 'error', text: event.message ?? '重试失败' }
      return
    case 'protocol_error':
      view.banner = { kind: 'error', text: event.message }
      return
    case 'process_exit':
      view.status = 'error'
      view.banner = {
        kind: 'error',
        text: `pi 已退出：${event.stderrTail || event.code || event.signal}`
      }
      return
    case 'extension_error':
      view.banner = { kind: 'error', text: event.message }
      return
    default:
      return
  }
}

function applyDelta(view: ChatView, event: Extract<DomainEvent, { type: 'delta' }>): void {
  const message = lastAssistant(view)
  if (!message) return
  const block = ensureBlock(message, event.contentIndex, event.kind)
  if (event.kind === 'toolcall') {
    block.toolCallId = event.toolCallId ?? block.toolCallId
    return
  }
  block.text = `${block.text ?? ''}${event.text ?? ''}`
  block.streaming = true
}

function applyBlockEnd(view: ChatView, event: Extract<DomainEvent, { type: 'block_end' }>): void {
  const message = lastAssistant(view)
  if (!message) return
  const block = ensureBlock(message, event.contentIndex, event.kind)
  block.text = event.content
  block.streaming = false
}

function ensureBlock(
  message: MessageView,
  index: number,
  kind: MessageBlock['kind']
): MessageBlock {
  for (let i = message.blocks.length; i <= index; i += 1) {
    message.blocks.push({ kind: kind === 'toolcall' ? 'tool' : kind, text: '', streaming: true })
  }
  const block = message.blocks[index]
  if (kind === 'toolcall') block.kind = 'tool'
  return block
}

function lastAssistant(view: ChatView): MessageView | undefined {
  for (let i = view.messages.length - 1; i >= 0; i -= 1) {
    if (view.messages[i].role === 'assistant') return view.messages[i]
  }
  return undefined
}

function toMessageView(raw: unknown): MessageView {
  const message = raw as { id?: string; role?: string; content?: unknown }
  return {
    id: message.id ?? `msg_${Math.random().toString(36).slice(2, 10)}`,
    role: message.role === 'user' ? 'user' : 'assistant',
    blocks: []
  }
}

function toText(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    return value.map((block: any) => (typeof block?.text === 'string' ? block.text : '')).join('')
  }
  if (value && typeof value === 'object' && 'content' in value) {
    return toText((value as { content: unknown }).content)
  }
  return ''
}
```

- [ ] **Step 4: 实现 `store/chat.ts`（state/action 解耦）**

```ts
import { create } from 'zustand'
import type { PiBatch } from '@shared/piProtocol'
import { initialChatView, reduceBatch, type ChatView } from '../controller/reducePiEvent'

export const useChatStore = create<ChatView>(() => initialChatView())

export const chatActions = {
  apply: (batch: PiBatch): void => useChatStore.setState((view) => reduceBatch(view, batch)),
  reset: (): void => useChatStore.setState(initialChatView(), true),
  setSession: (sessionPath: string | null): void => useChatStore.setState({ sessionPath })
}
```

- [ ] **Step 5: 跑测试确认通过并提交**

Run: `yarn test src/renderer/src/pages/home/controller/reducePiEvent.test.ts`
Expected: PASS

```bash
git add src/renderer/src/pages/home/controller src/renderer/src/pages/home/store/chat.ts
git commit -m "feat(ui): reduce domain events into chat view state"
```

---

### Task 11: IPC + preload + 渲染桥接

**Files:**

- Create: `src/main/ipc.ts`
- Modify: `src/main/index.ts`
- Modify: `src/preload/index.ts`、`src/preload/index.d.ts`
- Create: `src/renderer/src/pages/home/controller/usePiBridge.ts`
- Modify: `src/renderer/src/pages/home/components/Chat/index.tsx`（状态条占位）

**Interfaces:**

- Consumes: `PiGateway`、`SessionIndex`、`ProjectRegistry`、`PiCommand`、`PiBatch`、`PiBridge`
- Produces: `window.api.pi.invoke/onEvent`
- Produces: `registerPiIpc({ gateway, projects, sessions, getWindow })`

- [ ] **Step 1: 实现 `src/main/ipc.ts`（含白名单校验）**

```ts
import { stat } from 'node:fs/promises'
import { BrowserWindow, dialog, ipcMain } from 'electron'
import type { PiCommand, PiResult } from '@shared/piProtocol'
import type { PiGateway } from './pi/piGateway'
import type { SessionIndex } from './pi/sessionIndex'
import type { ProjectRegistry } from './projects'

export const INVOKE_CHANNEL = 'piper:invoke'
export const EVENT_CHANNEL = 'piper:event'

const COMMANDS = new Set<PiCommand['type']>([
  'start',
  'stop',
  'prompt',
  'abort',
  'clearQueue',
  'state',
  'messages',
  'models',
  'setModel',
  'thinkingLevels',
  'setThinkingLevel',
  'stats',
  'newSession',
  'switchSession',
  'renameSession',
  'sessions',
  'projects',
  'addProject',
  'removeProject',
  'renameProject',
  'pickDirectory',
  'extensionRespond'
])

export function isKnownCommand(value: unknown): value is PiCommand {
  if (!value || typeof value !== 'object') return false
  const type = (value as { type?: unknown }).type
  return typeof type === 'string' && COMMANDS.has(type as PiCommand['type'])
}

export interface IpcDeps {
  gateway: PiGateway
  sessions: SessionIndex
  projects: ProjectRegistry
  getWindow: () => BrowserWindow | null
}

export function registerPiIpc(deps: IpcDeps): void {
  ipcMain.handle(INVOKE_CHANNEL, async (_event, command: unknown): Promise<PiResult> => {
    if (!isKnownCommand(command)) return { ok: false, error: 'unknown command' }
    try {
      return await route(deps, command)
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  })
}

async function route(deps: IpcDeps, command: PiCommand): Promise<PiResult> {
  switch (command.type) {
    case 'projects':
      return { ok: true, data: await deps.projects.list() }
    case 'addProject': {
      const window = deps.getWindow()
      const options: Electron.OpenDialogOptions = {
        properties: ['openDirectory', 'createDirectory']
      }
      const picked = window
        ? await dialog.showOpenDialog(window, options)
        : await dialog.showOpenDialog(options)
      if (picked.canceled || picked.filePaths.length === 0) return { ok: false, error: 'cancelled' }
      return { ok: true, data: await deps.projects.add(picked.filePaths[0]) }
    }
    case 'removeProject':
      await deps.projects.remove(command.projectId)
      return { ok: true, data: null }
    case 'renameProject':
      return { ok: true, data: await deps.projects.rename(command.projectId, command.name) }
    case 'sessions': {
      const projects = await deps.projects.list()
      const project = projects.find((p) => p.id === command.projectId)
      if (!project) return { ok: false, error: 'project not found' }
      const all = await deps.sessions.list()
      return { ok: true, data: all.filter((s) => samePath(s.cwd, project.path)) }
    }
    case 'start':
      await stat(command.cwd).catch(() => {
        throw new Error('目录不存在')
      })
      return deps.gateway.handle(command)
    case 'prompt':
      if (!command.text.trim()) return { ok: false, error: '消息不能为空' }
      return deps.gateway.handle(command)
    case 'pickDirectory': {
      const picked = await dialog.showOpenDialog({ properties: ['openDirectory'] })
      return { ok: true, data: picked.canceled ? null : picked.filePaths[0] }
    }
    default:
      return deps.gateway.handle(command)
  }
}

function samePath(a: string, b: string): boolean {
  const left = a.replace(/[\\/]+$/, '')
  const right = b.replace(/[\\/]+$/, '')
  return process.platform === 'win32' || process.platform === 'darwin'
    ? left.toLowerCase() === right.toLowerCase()
    : left === right
}
```

- [ ] **Step 2: 在 `src/main/index.ts` 里装配**

在 `app.whenReady()` 内、创建窗口前：

```ts
import { join } from 'path'
import { accessSync } from 'fs'
import { PiGateway } from './pi/piGateway'
import { PiProcess } from './pi/piProcess'
import { resolvePiPath, isVersionSupported } from './pi/resolvePi'
import { SessionIndex, resolveSessionsDir } from './pi/sessionIndex'
import { ProjectRegistry } from './projects'
import { registerPiIpc, EVENT_CHANNEL } from './ipc'

const gateway = new PiGateway({
  openProcess: (options) => PiProcess.spawn(options),
  resolvePi: async () => {
    const command = resolvePiPath({
      env: process.env,
      pathEnv: process.env.PATH ?? '',
      exists: (candidate) => {
        try {
          accessSync(candidate)
          return true
        } catch {
          return false
        }
      }
    })
    if (!command) throw new Error('未找到 pi，请先安装 @earendil-works/pi-coding-agent')
    const { execFile } = await import('node:child_process')
    const version = await new Promise<string>((resolve, reject) => {
      execFile(command, ['--version'], (error, stdout) => {
        if (error) reject(error)
        else resolve(stdout.trim())
      })
    })
    return {
      command,
      version,
      warning: isVersionSupported(version) ? undefined : `pi 版本 ${version} 低于 1.6.0`
    }
  },
  emit: (batch) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(EVENT_CHANNEL, batch)
    }
  }
})

app.on('before-quit', () => {
  void gateway.handle({ type: 'stop' })
})

const userData = app.getPath('userData')
const sessions = new SessionIndex({ sessionsDir: resolveSessionsDir(process.env) })
const projects = new ProjectRegistry({ filePath: join(userData, 'projects.json') })
registerPiIpc({
  gateway,
  sessions,
  projects,
  getWindow: () => BrowserWindow.getAllWindows()[0] ?? null
})
```

- [ ] **Step 3: preload 暴露桥接并写类型**

`src/preload/index.ts`：

```ts
import { contextBridge, ipcRenderer } from 'electron'
import type { PiBatch, PiBridge } from '@shared/piProtocol'

const pi: PiBridge = {
  invoke: (command) => ipcRenderer.invoke('piper:invoke', command),
  onEvent: (listener) => {
    const handler = (_event: unknown, batch: PiBatch): void => listener(batch)
    ipcRenderer.on('piper:event', handler)
    return () => ipcRenderer.removeListener('piper:event', handler)
  }
}

contextBridge.exposeInMainWorld('api', { platform: process.platform, pi })
```

`src/preload/index.d.ts`：

```ts
import type { PiBridge } from '@shared/piProtocol'

export interface PiperApi {
  platform: string
  pi: PiBridge
}

declare global {
  interface Window {
    api: PiperApi
  }
}
```

- [ ] **Step 4: 写 `usePiBridge` 并在 Chat 顶部显示状态**

```ts
import { useEffect } from 'react'
import { chatActions } from '../store/chat'

export function usePiBridge(): void {
  useEffect(() => window.api.pi.onEvent(chatActions.apply), [])
}
```

`Chat` 组件顶部加一行（数据来自 `useChatStore`）：

```tsx
const status = useChatStore((state) => state.status)
const banner = useChatStore((state) => state.banner)
// header 下：
<div className="text-accent-neutral px-3 py-1 text-[11px]">
  {status === 'running' ? '运行中' : status === 'error' ? '连接异常' : '空闲'}
</div>
{banner && <div className="text-accent-rose px-3 py-1 text-[11px]">{banner.text}</div>}
```

`pages/home/index.tsx` 顶部调用 `usePiBridge()`。

- [ ] **Step 5: 手动验证**

Run: `yarn dev`
Expected：窗口打开，状态条显示"空闲"；控制台无 `window.api is undefined`；在**渲染进程** DevTools 里执行 `await window.api.pi.invoke({ type: 'start', cwd: '/tmp' })` 能返回 `ok: true`（或完成 Task 12 后用 UI 触发）。

- [ ] **Step 6: 提交**

```bash
git add src/main/ipc.ts src/main/index.ts src/preload src/renderer/src/pages/home
git commit -m "feat: wire ipc, preload bridge and renderer event sink"
```

---

### Task 12: 项目/会话列表 + 恢复

**Files:**

- Create: `src/renderer/src/pages/home/store/projects.ts`
- Create: `src/renderer/src/pages/home/components/Sider/ProjectGroup.tsx`
- Create: `src/renderer/src/pages/home/components/Sider/SessionItem.tsx`
- Modify: `src/renderer/src/pages/home/components/Sider/index.tsx`
- Modify: `src/renderer/src/pages/home/index.tsx`

**Interfaces:**

- Consumes: `window.api.pi.invoke`、`Project`、`SessionSummary`、`chatActions`、`uiActions`
- Produces: `projectActions.load() / add() / remove(id) / rename(id, name) / toggle(id) / openSession(project, session) / newSession(project)`

- [ ] **Step 1: 实现 `store/projects.ts`**

```ts
import { create } from 'zustand'
import type { Project, SessionSummary } from '@shared/piProtocol'
import { chatActions } from './chat'

export interface ProjectsState {
  projects: Project[]
  sessions: Record<string, SessionSummary[]>
  expanded: Record<string, boolean>
  activeSessionPath: string | null
  loading: boolean
}

export const useProjectsStore = create<ProjectsState>(() => ({
  projects: [],
  sessions: {},
  expanded: {},
  activeSessionPath: null,
  loading: false
}))

export const projectActions = {
  load: async (): Promise<void> => {
    useProjectsStore.setState({ loading: true })
    const result = await window.api.pi.invoke({ type: 'projects' })
    if (!result.ok) {
      useProjectsStore.setState({ loading: false })
      return
    }
    const projects = result.data as Project[]
    useProjectsStore.setState((state) => ({
      projects,
      loading: false,
      expanded: {
        ...Object.fromEntries(projects.map((p) => [p.id, true])),
        ...state.expanded
      }
    }))
    await Promise.all(projects.map((p) => projectActions.loadSessions(p.id)))
  },
  loadSessions: async (projectId: string): Promise<void> => {
    const result = await window.api.pi.invoke({ type: 'sessions', projectId })
    if (!result.ok) return
    useProjectsStore.setState((state) => ({
      sessions: { ...state.sessions, [projectId]: result.data as SessionSummary[] }
    }))
  },
  add: async (): Promise<void> => {
    const result = await window.api.pi.invoke({ type: 'addProject' })
    if (!result.ok) return
    await projectActions.load()
  },
  remove: async (projectId: string): Promise<void> => {
    await window.api.pi.invoke({ type: 'removeProject', projectId })
    await projectActions.load()
  },
  rename: async (projectId: string, name: string): Promise<void> => {
    await window.api.pi.invoke({ type: 'renameProject', projectId, name })
    await projectActions.load()
  },
  toggle: (projectId: string): void =>
    useProjectsStore.setState((state) => ({
      expanded: { ...state.expanded, [projectId]: !state.expanded[projectId] }
    })),
  newSession: async (project: Project): Promise<void> => {
    // 不带 --session 启动 pi 本身就会创建新会话，无需再发 new_session
    const result = await window.api.pi.invoke({ type: 'start', cwd: project.path })
    if (!result.ok) return
    await projectActions.loadSessions(project.id)
  },
  openSession: async (project: Project, session: SessionSummary): Promise<void> => {
    const result = await window.api.pi.invoke({
      type: 'start',
      cwd: project.path,
      sessionPath: session.path
    })
    if (!result.ok) return
    chatActions.reset()
    chatActions.setSession(session.path)
    useProjectsStore.setState({ activeSessionPath: session.path })
    const state = await window.api.pi.invoke({ type: 'state' })
    if (state.ok) {
      const data = state.data as { sessionFile?: string }
      useProjectsStore.setState({ activeSessionPath: data.sessionFile ?? session.path })
    }
    const messages = await window.api.pi.invoke({ type: 'messages' })
    if (messages.ok) {
      // 消息回放交给 M3 的 renderer reducer；M2 只验证能拿到消息
      console.info('replayed messages', (messages.data as { messages: unknown[] }).messages.length)
    }
  }
}
```

- [ ] **Step 2: 实现 `SessionItem` 与 `ProjectGroup`**

`SessionItem.tsx`：

```tsx
import type { JSX } from 'react'
import type { SessionSummary } from '@shared/piProtocol'
import { cn } from '@renderer/lib/utils'

interface SessionItemProps {
  session: SessionSummary
  active: boolean
  onOpen: () => void
}

export function SessionItem({ session, active, onOpen }: SessionItemProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'text-fore/80 hover:bg-card-hover w-full truncate rounded px-2 py-1.5 text-left text-xs',
        active && 'bg-card-hover text-fore'
      )}
      title={session.name ?? session.firstMessage}
    >
      {session.name || session.firstMessage || '未命名会话'}
    </button>
  )
}
```

`ProjectGroup.tsx`：

```tsx
import { ChevronRight, Plus } from 'lucide-react'
import type { JSX } from 'react'
import type { Project, SessionSummary } from '@shared/piProtocol'
import { cn } from '@renderer/lib/utils'
import { SessionItem } from './SessionItem'

interface ProjectGroupProps {
  project: Project
  sessions: SessionSummary[]
  expanded: boolean
  activeSessionPath: string | null
  onToggle: () => void
  onNewSession: () => void
  onOpenSession: (session: SessionSummary) => void
}

export function ProjectGroup(props: ProjectGroupProps): JSX.Element {
  return (
    <div className="mb-1">
      <div className="group hover:bg-card-hover flex items-center rounded px-1">
        <button
          type="button"
          onClick={props.onToggle}
          className="text-fore/80 flex min-w-0 flex-1 items-center gap-1 py-1.5 text-left text-xs"
        >
          <ChevronRight
            className={cn('size-3 shrink-0 transition-transform', props.expanded && 'rotate-90')}
          />
          <span className="truncate">{props.project.name}</span>
          {!props.project.available && <span className="text-accent-rose">目录失效</span>}
        </button>
        <button
          type="button"
          aria-label="新建会话"
          onClick={props.onNewSession}
          className="text-accent-neutral hover:text-fore opacity-0 group-hover:opacity-100"
        >
          <Plus className="size-3.5" />
        </button>
      </div>
      {props.expanded && (
        <div className="border-accent-neutral/20 mt-1 ml-3 space-y-0.5 border-l pl-2">
          {props.sessions.length === 0 && (
            <p className="text-accent-neutral px-2 py-1 text-[11px]">暂无会话</p>
          )}
          {props.sessions.map((session) => (
            <SessionItem
              key={session.path}
              session={session}
              active={session.path === props.activeSessionPath}
              onOpen={() => props.onOpenSession(session)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: 重写 `Sider` 接入 store**

```tsx
import { Plus, RefreshCw } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { projectActions, useProjectsStore } from '../../store/projects'
import { ProjectGroup } from './ProjectGroup'

export function Sider(): React.JSX.Element {
  const projects = useProjectsStore((state) => state.projects)
  const sessions = useProjectsStore((state) => state.sessions)
  const expanded = useProjectsStore((state) => state.expanded)
  const activeSessionPath = useProjectsStore((state) => state.activeSessionPath)
  const loading = useProjectsStore((state) => state.loading)

  return (
    <div className="bg-card flex h-full flex-col">
      <div className="window-drag flex h-12 shrink-0 items-center gap-2 pr-2 pl-[var(--titlebar-inset)]">
        <span className="text-sm font-medium">Piper</span>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-1">
        {projects.map((project) => (
          <ProjectGroup
            key={project.id}
            project={project}
            sessions={sessions[project.id] ?? []}
            expanded={expanded[project.id] ?? false}
            activeSessionPath={activeSessionPath}
            onToggle={() => projectActions.toggle(project.id)}
            onNewSession={() => void projectActions.newSession(project)}
            onOpenSession={(session) => void projectActions.openSession(project, session)}
          />
        ))}
        {projects.length === 0 && !loading && (
          <p className="text-accent-neutral px-2 py-3 text-xs">还没有项目</p>
        )}
      </div>

      <div className="border-accent-neutral/20 border-t p-2">
        <Button
          variant="ghost"
          size="sm"
          className="text-accent-neutral w-full justify-start gap-2"
          onClick={() => void projectActions.add()}
        >
          <Plus />
          添加项目
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-accent-neutral w-full justify-start gap-2"
          onClick={() => void projectActions.load()}
        >
          <RefreshCw />
          刷新
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 启动时加载项目，切会话时重置视图**

`pages/home/index.tsx` 顶部：

```tsx
import { useEffect } from 'react'
import { projectActions } from './store/projects'

useEffect(() => {
  void projectActions.load()
}, [])
```

`openSession` 里已经调用 `chatActions.reset()` + `chatActions.setSession(session.path)`（见 Step 1 代码），确保切换会话时旧视图不残留。

- [ ] **Step 5: 手动验证**

Run: `yarn dev`
Expected：

1. 点"添加项目"选一个真实目录 → 项目出现在左侧。
2. 项目行 hover 出现 `+`，点击后在该项目下出现新会话（可能需要刷新列表）。
3. 点击会话 → 项目内该会话高亮，主区标题显示会话名。
4. 重启应用后项目仍在（读 `userData/projects.json`）。

- [ ] **Step 6: 提交**

```bash
git add src/renderer/src/pages/home
git commit -m "feat(ui): project tree with sessions and new-session action"
```

---

## 后续里程碑（各自单独出计划）

- **M3 对话**：`Chat` 消息列表（`@tanstack/react-virtual`）、Markdown（`streamdown` + `prose.css`）、工具卡片、thinking 折叠、composer 发送 `prompt`。
- **M4 队列与状态**：steer / follow-up 切换、队列 chips、`queue_update`、重试/压缩状态条、`get_session_stats` 显示 token/cost。
- **M5 模型与扩展**：模型/thinking 选择器（Radix Popover + cmdk）、`extension_ui_request` 对话框（select/confirm/input/editor）、`notify` → sonner、`setTitle`。
- **M6 收尾**：崩溃重连与 `get_messages` 回放、会话重命名、空态、快捷键（`react-hotkeys-hook`）、手工验收清单。

## 交付标准（M2 结束时）

- `yarn typecheck`、`yarn test`、`yarn build` 全绿。
- 能用真实 pi：添加项目 → 新建会话 → 发送一条 prompt（命令行或临时按钮）→ 事件进入 reducer（UI 可以只显示状态与原始消息数）。
- 崩溃模拟（kill pi 进程）后状态条显示错误，应用不崩。
