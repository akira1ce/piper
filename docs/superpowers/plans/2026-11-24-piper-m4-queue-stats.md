# Piper M4（队列与状态）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把"运行中"的状态补完整：队列可见可清、重试可中止、会话 token/成本可见。

**Architecture:** 继续单向流：pi 事件 → reducer 更新 `ChatView`；统计通过现有 `stats` 命令拉取后写入 store；队列用 `queue` 事件，清空用 `clearQueue` 命令。

**Tech Stack:** React 19、zustand、Tailwind、lucide-react。

**Spec:** `docs/superpowers/specs/2026-11-24-piper-v1-design.md`

## Global Constraints

- 分支 `feat/m4-queue`，fork 自 `main`（已含 M1–M3）。
- 只在 `pages/home` 内改动；协议类型改动必须同步 `src/shared`、`src/main/ipc.ts`、`src/main/pi/piGateway.ts`。
- 颜色只用 token；不写死色值。
- `yarn typecheck`、`yarn test`、`yarn lint`、`yarn build` 全绿。

---

### Task 1: 统计类型与格式化

**Files:**

- Modify: `src/shared/piProtocol.ts`
- Create: `src/renderer/src/pages/home/util/formatStats.ts`
- Test: `src/renderer/src/pages/home/util/formatStats.test.ts`

**Interfaces:**

- Produces: `SessionStats`、`formatTokens(n)`、`formatCost(n)`、`formatContext(usage)`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, it } from 'vitest'
import { formatContext, formatCost, formatTokens } from './formatStats'

describe('formatStats', () => {
  it('formats token counts compactly', () => {
    expect(formatTokens(999)).toBe('999')
    expect(formatTokens(12_400)).toBe('12.4k')
    expect(formatTokens(105_000)).toBe('105k')
  })

  it('formats cost with 2-3 decimals', () => {
    expect(formatCost(0.4567)).toBe('$0.46')
    expect(formatCost(0)).toBe('$0.00')
  })

  it('formats context usage', () => {
    expect(formatContext({ tokens: 60_000, contextWindow: 200_000, percent: 30 })).toBe(
      '60k / 200k · 30%'
    )
    expect(formatContext({ tokens: null, contextWindow: 200_000, percent: null })).toBe('—')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `yarn test src/renderer/src/pages/home/util/formatStats.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现**

`src/shared/piProtocol.ts` 追加：

```ts
export interface SessionStats {
  userMessages?: number
  assistantMessages?: number
  toolCalls?: number
  tokens?: { input: number; output: number; cacheRead: number; cacheWrite: number; total: number }
  cost?: number
  contextUsage?: { tokens: number | null; contextWindow: number; percent: number | null }
}
```

`formatStats.ts`：

```ts
import type { SessionStats } from '@shared/piProtocol'

export function formatTokens(value: number): string {
  if (value < 1000) return String(value)
  const scaled = value / 1000
  return `${scaled >= 100 ? Math.round(scaled) : Number(scaled.toFixed(1))}k`
}

export function formatCost(value: number): string {
  return `$${value.toFixed(2)}`
}

export function formatContext(usage: NonNullable<SessionStats['contextUsage']>): string {
  if (usage.tokens === null || usage.percent === null) return '—'
  return `${formatTokens(usage.tokens)} / ${formatTokens(usage.contextWindow)} · ${usage.percent}%`
}
```

- [ ] **Step 4: 通过并提交**

Run: `yarn test src/renderer/src/pages/home/util/formatStats.test.ts`

```bash
git add src/shared/piProtocol.ts src/renderer/src/pages/home/util
git commit -m "feat(stats): session stats types and formatting"
```

---

### Task 2: 重试可中止

**Files:**

- Modify: `src/shared/piProtocol.ts`（`abortRetry`）
- Modify: `src/main/pi/piGateway.ts`
- Modify: `src/main/ipc.ts`
- Modify: `src/renderer/src/pages/home/controller/reducePiEvent.ts`
- Test: `src/renderer/src/pages/home/controller/reducePiEvent.test.ts`

**Interfaces:**

- `PiCommand` 新增 `{ type: 'abortRetry' }`
- `ChatView` 新增 `retryAttempt: number | null`
- 产生 `chatActions.abortRetry()`

- [ ] **Step 1: 写失败测试**

追加 reducer 测试：

```ts
it('tracks retry attempts until success', () => {
  let view = reduceBatch(initialChatView(), batch([{ type: 'retry', phase: 'start', attempt: 2 }]))
  expect(view.retryAttempt).toBe(2)
  view = reduceBatch(view, batch([{ type: 'retry', phase: 'end', success: true }], 2))
  expect(view.retryAttempt).toBeNull()
})
```

Run: `yarn test src/renderer/src/pages/home/controller/reducePiEvent.test.ts`
Expected: FAIL（`retryAttempt` 不存在）

- [ ] **Step 2: 实现**

`ChatView` 增加 `retryAttempt: number | null`（初始 `null`）；`case 'retry'`：

```ts
case 'retry':
  view.retryAttempt = event.phase === 'start' ? (event.attempt ?? 1) : null
  view.banner = event.phase === 'start' ? { kind: 'info', text: `重试中（第 ${event.attempt ?? 1} 次）` } : event.success ? null : { kind: 'error', text: event.message ?? '重试失败' }
  return
```

`PiCommand` + `ipc.ts` 白名单加 `abortRetry`；`piGateway.ts`：

```ts
case 'abortRetry':
  return this.requireClient().request({ type: 'abort_retry' })
```

`chatActions.abortRetry`：

```ts
abortRetry: async (): Promise<void> => {
  await window.api.pi.invoke({ type: 'abortRetry' })
}
```

- [ ] **Step 3: UI：状态条上的中止按钮**

`Chat/index.tsx`：`const retryAttempt = useChatStore((s) => s.retryAttempt)`；状态条右侧：

```tsx
{
  retryAttempt !== null && (
    <button
      type="button"
      onClick={() => void chatActions.abortRetry()}
      className="text-accent-sky hover:text-fore text-[11px] underline underline-offset-2"
    >
      中止重试（第 {retryAttempt} 次）
    </button>
  )
}
```

（状态条改成 `flex items-center justify-between`。）

- [ ] **Step 4: 通过 + typecheck + 提交**

```bash
yarn test src/renderer/src/pages/home/controller/reducePiEvent.test.ts && yarn typecheck
git add src/shared src/main src/renderer/src/pages/home
git commit -m "feat(chat): show and abort retries"
```

---

### Task 3: 队列 chips 与清空

**Files:**

- Create: `src/renderer/src/pages/home/components/Chat/QueueChips.tsx`
- Modify: `src/renderer/src/pages/home/store/chat.ts`
- Modify: `src/renderer/src/pages/home/components/Chat/index.tsx`

**Interfaces:**

- `chatActions.clearQueue(): Promise<void>`
- `<QueueChips />` 读取 `queue`

- [ ] **Step 1: store 增加 clearQueue**

```ts
clearQueue: async (): Promise<void> => {
  const result = await window.api.pi.invoke({ type: 'clearQueue' })
  if (!result.ok) return
  const data = result.data as { steering: string[]; followUp: string[] }
  useChatStore.setState({ queue: { steering: data.steering, followUp: data.followUp } })
}
```

- [ ] **Step 2: 组件**

```tsx
import { X } from 'lucide-react'
import { chatActions } from '../../store/chat'
import { useChatStore } from '../../store/chat'

export function QueueChips(): React.JSX.Element | null {
  const queue = useChatStore((state) => state.queue)
  const total = queue.steering.length + queue.followUp.length
  if (total === 0) return null

  return (
    <div className="mx-auto mb-2 flex max-w-3xl flex-wrap items-center gap-1.5 px-4">
      {queue.steering.map((text, index) => (
        <span
          key={`s-${index}`}
          className="border-accent-sky/40 text-accent-sky max-w-64 truncate rounded-full border px-2 py-0.5 text-[11px]"
        >
          引导 · {text}
        </span>
      ))}
      {queue.followUp.map((text, index) => (
        <span
          key={`f-${index}`}
          className="border-accent-violet/40 text-accent-violet max-w-64 truncate rounded-full border px-2 py-0.5 text-[11px]"
        >
          追问 · {text}
        </span>
      ))}
      <button
        type="button"
        onClick={() => void chatActions.clearQueue()}
        className="text-accent-neutral hover:text-fore flex items-center gap-0.5 text-[11px]"
      >
        <X className="size-3" />
        清空
      </button>
    </div>
  )
}
```

- [ ] **Step 3: 接入 Chat**

`Chat/index.tsx` 在 `<Composer />` 前加 `<QueueChips />`（Composer 在 footer 里，QueueChips 放 `MessageList` 与 `Composer` 之间、`px-4` 已有则去掉内层 padding）。

- [ ] **Step 4: 提交**

```bash
yarn typecheck && yarn lint
git add src/renderer/src/pages/home
git commit -m "feat(chat): queue chips with clear action"
```

---

### Task 4: 统计展示与自动刷新

**Files:**

- Modify: `src/renderer/src/pages/home/store/chat.ts`
- Create: `src/renderer/src/pages/home/components/Chat/StatsBar.tsx`
- Modify: `src/renderer/src/pages/home/components/Chat/index.tsx`

**Interfaces:**

- `ChatView.stats: SessionStats | null`
- `chatActions.loadStats(): Promise<void>`

- [ ] **Step 1: store**

`ChatView` 加 `stats: SessionStats | null`（初始 null）；

```ts
loadStats: async (): Promise<void> => {
  const result = await window.api.pi.invoke({ type: 'stats' })
  if (!result.ok) return
  useChatStore.setState({ stats: result.data as SessionStats })
}
```

- [ ] **Step 2: 组件**

```tsx
import { useChatStore } from '../../store/chat'
import { formatContext, formatCost, formatTokens } from '../../util/formatStats'

export function StatsBar(): React.JSX.Element | null {
  const stats = useChatStore((state) => state.stats)
  if (!stats) return null
  const total = stats.tokens?.total ?? 0
  const context = stats.contextUsage ? formatContext(stats.contextUsage) : null
  return (
    <div
      className="text-accent-neutral flex items-center gap-2 text-[10px]"
      title={context ?? undefined}
    >
      <span>{formatTokens(total)} tokens</span>
      <span>·</span>
      <span>{formatCost(stats.cost ?? 0)}</span>
      {context && (
        <>
          <span>·</span>
          <span>{context}</span>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 3: 自动刷新**

`Chat/index.tsx`：

```tsx
const status = useChatStore((state) => state.status)
const sessionPath = useChatStore((state) => state.sessionPath)

useEffect(() => {
  if (status === 'idle' && sessionPath) void chatActions.loadStats()
}, [status, sessionPath])
```

顶部状态条右侧放 `<StatsBar />`（与状态文案同一行、`justify-between`）。

- [ ] **Step 4: 手动验证**

Run: `yarn dev` → 打开一条历史会话：状态条右侧出现 token/成本/上下文；发一条消息结束后数值刷新。

- [ ] **Step 5: 全量校验 + 提交**

```bash
yarn typecheck && yarn test && yarn lint && yarn build
git add src/renderer/src/pages/home
git commit -m "feat(chat): session stats bar with auto refresh"
```

---

## 延后项

- 队列消息单条取消（pi 只提供整体清空）。
- 成本按模型分项、按会话累计图。
- `steeringMode` / `followUpMode` 开关 UI。

## 交付标准

- 运行中能看到队列并以"引导/追问"区分，可一键清空。
- 重试进行中可中止，状态条显示次数。
- 会话 token/成本/上下文可见，消息结束后自动刷新。
