# Piper M3（对话流）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 pi 的会话真正可读可用：历史回放、流式 Markdown、thinking、工具卡片、composer 发送与中断。

**Architecture:** 继续单向数据流：`AgentMessage` → `messagesToView`（纯函数）→ `ChatView`；流式文本由 reducer 增量拼接，`message_end` 用权威消息覆盖；渲染层只消费 `MessageView`/`ToolCallView`。

**Tech Stack:** React 19、zustand 5、Tailwind 4、`streamdown` + `@streamdown/code`（Shiki）、lucide-react。

**Spec:** `docs/superpowers/specs/2026-11-24-piper-v1-design.md`

## Global Constraints

- 分支从 `feat/m1-m2` 切出：`feat/m3-chat`；不要动 `main`。
- 颜色只用 `theme/tokens.css` 的 token；`pages/` 下不写 shadcn 变量名。
- 渲染进程不解析协议原始字段：只经 `controller/` 的纯函数。
- `yarn typecheck`、`yarn test`、`yarn lint`、`yarn build` 必须全绿。
- 新增运行时依赖只允许：`streamdown`、`@streamdown/code`（渲染进程，放 devDependencies）。
- 消息列表 **v1 不做虚拟滚动**（变高 Markdown + 流式测量成本高，先保证正确滚动锚定）；记录为延后项。
- 工具卡片状态以 `toolCalls[toolCallId]` 为准，不重复解析消息里的工具块。

---

## 文件结构

```
src/renderer/src/pages/home/
├── controller/messagesToView.ts         AgentMessage[] → MessageView[] + ToolCallView
├── controller/messagesToView.test.ts
├── controller/reducePiEvent.ts          message_end 权威覆盖、跳过 toolResult
├── controller/useStickToBottom.ts       滚动锚定 hook
├── store/chat.ts                        loadMessages()
├── components/Chat/index.tsx            组合：状态条 + MessageList + Composer
├── components/Chat/MessageList.tsx
├── components/Chat/MessageItem.tsx      user 气泡 / assistant blocks
├── components/Chat/Markdown.tsx         Streamdown 包装
├── components/Chat/ThinkingBlock.tsx
├── components/Chat/ToolCallCard.tsx
└── components/Chat/Composer.tsx
src/renderer/src/styles/main.css         streamdown CSS + @source
src/renderer/src/styles/prose.css        Streamdown/typography 细节
```

---

### Task 1: 消息映射与权威覆盖

**Files:**

- Create: `src/renderer/src/pages/home/controller/messagesToView.ts`
- Test: `src/renderer/src/pages/home/controller/messagesToView.test.ts`
- Modify: `src/renderer/src/pages/home/controller/reducePiEvent.ts`
- Modify: `src/renderer/src/pages/home/controller/reducePiEvent.test.ts`
- Modify: `src/renderer/src/pages/home/store/chat.ts`

**Interfaces:**

- Produces: `messagesToView(raw: unknown[]): { messages: MessageView[]; toolCalls: Record<string, ToolCallView> }`
- Produces: `messageToView(raw: unknown): MessageView | null`（`system` / `toolResult` 返回 null）
- Produces: `chatActions.loadMessages(raw: unknown[]): void`

- [ ] **Step 1: 写失败测试 `messagesToView.test.ts`**

```ts
import { describe, expect, it } from 'vitest'
import { messagesToView } from './messagesToView'

describe('messagesToView', () => {
  it('maps user text and assistant text/thinking/toolCall blocks', () => {
    const { messages, toolCalls } = messagesToView([
      { role: 'user', content: '你好', timestamp: 1 },
      {
        role: 'assistant',
        content: [
          { type: 'thinking', thinking: '先看目录' },
          { type: 'text', text: '好的' },
          { type: 'toolCall', id: 'c1', name: 'bash', arguments: { command: 'ls' } }
        ],
        timestamp: 2
      }
    ])

    expect(messages).toHaveLength(2)
    expect(messages[0]).toMatchObject({ role: 'user', blocks: [{ kind: 'text', text: '你好' }] })
    expect(messages[1].blocks.map((block) => block.kind)).toEqual(['thinking', 'text', 'tool'])
    expect(messages[1].blocks[2].toolCallId).toBe('c1')
    expect(toolCalls.c1).toMatchObject({
      toolName: 'bash',
      args: { command: 'ls' },
      state: 'running'
    })
  })

  it('attaches tool results to the matching tool block', () => {
    const { messages, toolCalls } = messagesToView([
      {
        role: 'assistant',
        content: [{ type: 'toolCall', id: 'c1', name: 'bash', arguments: { command: 'ls' } }],
        timestamp: 1
      },
      {
        role: 'toolResult',
        toolCallId: 'c1',
        toolName: 'bash',
        content: [{ type: 'text', text: 'file-a\nfile-b' }],
        isError: false,
        timestamp: 2
      }
    ])

    expect(messages).toHaveLength(1)
    expect(toolCalls.c1).toMatchObject({ state: 'done', preview: 'file-a\nfile-b' })
  })

  it('marks errored tool results', () => {
    const { toolCalls } = messagesToView([
      {
        role: 'assistant',
        content: [{ type: 'toolCall', id: 'c1', name: 'bash', arguments: {} }],
        timestamp: 1
      },
      {
        role: 'toolResult',
        toolCallId: 'c1',
        toolName: 'bash',
        content: [{ type: 'text', text: 'boom' }],
        isError: true,
        timestamp: 2
      }
    ])
    expect(toolCalls.c1.state).toBe('error')
  })

  it('skips system messages and renders image placeholders', () => {
    const { messages } = messagesToView([
      { role: 'system', content: 'prompt', timestamp: 1 },
      {
        role: 'user',
        content: [
          { type: 'text', text: '看图' },
          { type: 'image', data: 'xx', mimeType: 'image/png' }
        ],
        timestamp: 2
      }
    ])
    expect(messages).toHaveLength(1)
    expect(messages[0].blocks.map((block) => block.text)).toEqual(['看图', '[图片]'])
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `yarn test src/renderer/src/pages/home/controller/messagesToView.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 `messagesToView.ts`**

```ts
import type { MessageBlock, MessageView, ToolCallView } from '@shared/piProtocol'

interface RawBlock {
  type?: string
  text?: string
  thinking?: string
  id?: string
  name?: string
  arguments?: unknown
}

interface RawMessage {
  role?: string
  content?: unknown
  toolCallId?: string
  toolName?: string
  isError?: boolean
}

export function messagesToView(raw: unknown[]): {
  messages: MessageView[]
  toolCalls: Record<string, ToolCallView>
} {
  const messages: MessageView[] = []
  const toolCalls: Record<string, ToolCallView> = {}

  for (const item of raw) {
    const message = item as RawMessage
    if (message.role === 'toolResult') {
      applyToolResult(toolCalls, message)
      continue
    }
    const view = messageToView(message, messages.length)
    if (view) messages.push(view)
  }

  // 历史里没有工具事件，用 toolCall 块补出卡片
  for (const message of messages) {
    for (const block of message.blocks) {
      if (block.kind !== 'tool' || !block.toolCallId) continue
      const existing = toolCalls[block.toolCallId]
      toolCalls[block.toolCallId] = {
        toolCallId: block.toolCallId,
        toolName: existing?.toolName ?? 'tool',
        args: existing?.args ?? {},
        state: existing?.state ?? 'done',
        preview: existing?.preview ?? ''
      }
    }
  }

  return { messages, toolCalls }
}

export function messageToView(raw: unknown, index = 0): MessageView | null {
  const message = raw as RawMessage
  if (message.role !== 'user' && message.role !== 'assistant') return null
  return {
    id: `m_${index}`,
    role: message.role,
    blocks: toBlocks(message.content)
  }
}

function toBlocks(content: unknown): MessageBlock[] {
  if (typeof content === 'string') return [{ kind: 'text', text: content, streaming: false }]
  if (!Array.isArray(content)) return []

  const blocks: MessageBlock[] = []
  for (const item of content as RawBlock[]) {
    if (item.type === 'text') {
      blocks.push({ kind: 'text', text: item.text ?? '', streaming: false })
    } else if (item.type === 'thinking') {
      blocks.push({ kind: 'thinking', text: item.thinking ?? '', streaming: false })
    } else if (item.type === 'image') {
      blocks.push({ kind: 'text', text: '[图片]', streaming: false })
    } else if (item.type === 'toolCall') {
      blocks.push({ kind: 'tool', toolCallId: item.id, text: '', streaming: false })
    }
  }
  return blocks
}

function applyToolResult(toolCalls: Record<string, ToolCallView>, message: RawMessage): void {
  const id = message.toolCallId
  if (!id) return
  const preview = toText(message.content).slice(0, 2000)
  toolCalls[id] = {
    toolCallId: id,
    toolName: message.toolName ?? 'tool',
    args: toolCalls[id]?.args ?? {},
    state: message.isError ? 'error' : 'done',
    preview
  }
}

export function toText(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map((block) => {
      const text = (block as { text?: unknown } | null)?.text
      return typeof text === 'string' ? text : ''
    })
    .filter(Boolean)
    .join('\n')
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `yarn test src/renderer/src/pages/home/controller/messagesToView.test.ts`
Expected: PASS（4 个用例）

- [ ] **Step 5: 写失败的 reducer 测试（权威覆盖 + 跳过 toolResult）**

追加到 `reducePiEvent.test.ts`：

```ts
it('replaces the streaming message on message_end', () => {
  let view = initialChatView()
  view = reduceBatch(
    view,
    batch([
      { type: 'message_start', message: { role: 'assistant', content: [] } },
      { type: 'delta', kind: 'text', contentIndex: 0, text: 'partial' }
    ])
  )
  view = reduceBatch(
    view,
    batch([
      {
        type: 'message_end',
        message: {
          role: 'assistant',
          content: [
            { type: 'thinking', thinking: '想' },
            { type: 'text', text: '权威文本' }
          ]
        }
      }
    ]),
    2
  )
  expect(view.messages[0].blocks.map((block) => block.kind)).toEqual(['thinking', 'text'])
  expect(view.messages[0].blocks[1].text).toBe('权威文本')
})

it('ignores toolResult and system messages', () => {
  const view = reduceBatch(
    initialChatView(),
    batch([
      { type: 'message_start', message: { role: 'toolResult', content: 'x' } },
      { type: 'message_end', message: { role: 'system', content: 'y' } }
    ])
  )
  expect(view.messages).toHaveLength(0)
})
```

Run: `yarn test src/renderer/src/pages/home/controller/reducePiEvent.test.ts`
Expected: FAIL（message_end 未处理）

- [ ] **Step 6: 改 reducer**

`reducePiEvent.ts`：

```ts
import { messageToView } from './messagesToView'

function applyEvent(view: ChatView, event: DomainEvent): void {
  // ...
  case 'message_start': {
    const message = messageToView(event.message, view.messages.length)
    if (message) view.messages.push(message)
    return
  }
  case 'message_end': {
    const message = messageToView(event.message)
    if (!message) return
    const last = lastByRole(view, message.role)
    if (last) {
      last.blocks = message.blocks
    } else {
      view.messages.push({ ...message, id: `m_${view.messages.length}` })
    }
    return
  }
  // ...
}

function lastByRole(view: ChatView, role: MessageView['role']): MessageView | undefined {
  for (let i = view.messages.length - 1; i >= 0; i -= 1) {
    if (view.messages[i].role === role) return view.messages[i]
  }
  return undefined
}
```

同时删除 `toMessageView` 与 `toText`（已由 `messagesToView.ts` 提供；reducer 里 `toText` 仍被 tool preview 使用，改为从 `messagesToView` 导入 `toText`）。

- [ ] **Step 7: 跑测试确认通过**

Run: `yarn test src/renderer/src/pages/home/controller/`
Expected: PASS（含既有 5 个 + 新增 2 个）

- [ ] **Step 8: store 增加 `loadMessages`**

`store/chat.ts`：

```ts
import { messagesToView } from '../controller/messagesToView'

export const chatActions = {
  // ...
  loadMessages: (raw: unknown[]): void => {
    const { messages, toolCalls } = messagesToView(raw)
    useChatStore.setState({ messages, toolCalls })
  }
}
```

- [ ] **Step 9: typecheck + 提交**

Run: `yarn typecheck && yarn lint`
Expected: 全绿

```bash
git add src/renderer/src/pages/home
git commit -m "feat(chat): map agent messages to view with tool results"
```

---

### Task 2: Markdown 包装（Streamdown + Shiki）

**Files:**

- Modify: `package.json`（`streamdown`、`@streamdown/code`）
- Modify: `src/renderer/src/styles/main.css`
- Modify: `src/renderer/src/styles/prose.css`
- Create: `src/renderer/src/pages/home/components/Chat/Markdown.tsx`

**Interfaces:**

- Produces: `<Markdown text streaming />`，供 `MessageItem` 使用

- [ ] **Step 1: 安装依赖**

```bash
yarn add -D streamdown@^2.8.0 @streamdown/code@^2.0.1
```

- [ ] **Step 2: 接入样式**

`styles/main.css` 顶部 import 追加：

```css
@import 'streamdown/styles.css';
```

文件末尾追加（路径从 `src/renderer/src/styles/` 上溯 4 层到仓库根）：

```css
@source '../../../../node_modules/streamdown/dist/*.js';
@source '../../../../node_modules/@streamdown/code/dist/*.js';
```

`styles/prose.css` 追加：

```css
/* Streamdown 代码块与表格在暗色下的细节 */
.prose pre {
  background: var(--bg-card);
  border-color: var(--bg-card-hover);
}

.prose table {
  font-size: 0.8125rem;
}

.prose a {
  text-underline-offset: 2px;
}
```

- [ ] **Step 3: 写 `Markdown.tsx`**

```tsx
import { code } from '@streamdown/code'
import { memo } from 'react'
import { Streamdown } from 'streamdown'

interface MarkdownProps {
  text: string
  streaming?: boolean
}

export const Markdown = memo(function Markdown({ text, streaming }: MarkdownProps) {
  return (
    <Streamdown className="prose" plugins={{ code }} isAnimating={streaming}>
      {text}
    </Streamdown>
  )
})
```

- [ ] **Step 4: 放行 WebAssembly（Shiki 可能用到）**

`src/main/index.ts` 的 CSP 里给 `script-src` 加 `'wasm-unsafe-eval'`（dev 与 prod 两处都要），否则生产环境代码高亮可能直接失败。

- [ ] **Step 5: 验证构建**

Run: `yarn build`
Expected: 成功；`out/renderer/assets/*.css` 体积较 M2 明显增大（Streamdown/Shiki 样式）

- [ ] **Step 6: 提交**

```bash
git add package.json yarn.lock src/main/index.ts src/renderer/src/styles src/renderer/src/pages/home/components/Chat/Markdown.tsx
git commit -m "feat(chat): add streamdown markdown renderer"
```

---

### Task 3: 消息列表、气泡与滚动锚定

**Files:**

- Create: `src/renderer/src/pages/home/controller/useStickToBottom.ts`
- Create: `src/renderer/src/pages/home/components/Chat/MessageItem.tsx`
- Create: `src/renderer/src/pages/home/components/Chat/MessageList.tsx`
- Modify: `src/renderer/src/pages/home/components/Chat/index.tsx`

**Interfaces:**

- Consumes: `MessageView`、`ToolCallView`、`<Markdown>`
- Produces: `useStickToBottom(deps)` 与 `<MessageList />`

- [ ] **Step 1: 写 `useStickToBottom.ts`**

```ts
import { useCallback, useEffect, useRef, useState } from 'react'

export function useStickToBottom(deps: unknown): {
  containerRef: React.RefObject<HTMLDivElement | null>
  atBottom: boolean
  scrollToBottom: () => void
} {
  const containerRef = useRef<HTMLDivElement>(null)
  const stickRef = useRef(true)
  const [atBottom, setAtBottom] = useState(true)

  const onScroll = useCallback(() => {
    const element = containerRef.current
    if (!element) return
    const bottom = element.scrollHeight - element.scrollTop - element.clientHeight < 48
    stickRef.current = bottom
    setAtBottom(bottom)
  }, [])

  const scrollToBottom = useCallback(() => {
    const element = containerRef.current
    if (!element) return
    element.scrollTop = element.scrollHeight
    stickRef.current = true
    setAtBottom(true)
  }, [])

  useEffect(() => {
    if (stickRef.current) scrollToBottom()
  }, [deps, scrollToBottom])

  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    element.addEventListener('scroll', onScroll, { passive: true })
    return () => element.removeEventListener('scroll', onScroll)
  }, [onScroll])

  return { containerRef, atBottom, scrollToBottom }
}
```

- [ ] **Step 2: 写 `MessageItem.tsx`**

```tsx
import type { JSX } from 'react'
import type { MessageView, ToolCallView } from '@shared/piProtocol'
import { Markdown } from './Markdown'
import { ThinkingBlock } from './ThinkingBlock'
import { ToolCallCard } from './ToolCallCard'

interface MessageItemProps {
  message: MessageView
  toolCalls: Record<string, ToolCallView>
}

export function MessageItem({ message, toolCalls }: MessageItemProps): JSX.Element {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="bg-card text-fore max-w-[80%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap">
          {message.blocks.map((block) => block.text).join('')}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2 text-sm">
      {message.blocks.map((block, index) => {
        if (block.kind === 'text') {
          return <Markdown key={index} text={block.text ?? ''} streaming={block.streaming} />
        }
        if (block.kind === 'thinking') {
          return <ThinkingBlock key={index} text={block.text ?? ''} streaming={block.streaming} />
        }
        const tool = block.toolCallId ? toolCalls[block.toolCallId] : undefined
        return tool ? <ToolCallCard key={index} tool={tool} /> : null
      })}
    </div>
  )
}
```

- [ ] **Step 3: 写 `MessageList.tsx`**

```tsx
import { ArrowDown } from 'lucide-react'
import { useChatStore } from '../../store/chat'
import { useStickToBottom } from '../../controller/useStickToBottom'
import { MessageItem } from './MessageItem'

export function MessageList(): React.JSX.Element {
  const messages = useChatStore((state) => state.messages)
  const toolCalls = useChatStore((state) => state.toolCalls)
  const { containerRef, atBottom, scrollToBottom } = useStickToBottom(
    `${messages.length}:${messages
      .at(-1)
      ?.blocks.map((block) => block.text?.length ?? 0)
      .join(',')}`
  )

  return (
    <div className="relative min-h-0 flex-1">
      <div ref={containerRef} className="h-full overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-accent-neutral text-xs">发一条消息，或从左侧打开会话</p>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-6">
            {messages.map((message) => (
              <MessageItem key={message.id} message={message} toolCalls={toolCalls} />
            ))}
          </div>
        )}
      </div>
      {!atBottom && messages.length > 0 && (
        <button
          type="button"
          onClick={scrollToBottom}
          className="bg-card border-accent-neutral/30 text-fore hover:bg-card-hover absolute right-4 bottom-4 flex size-8 items-center justify-center rounded-full border shadow"
          aria-label="回到底部"
        >
          <ArrowDown className="size-4" />
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 4: 把 Chat 的空态替换为 MessageList**

`Chat/index.tsx` 中删掉 `<section className="flex min-h-0 flex-1 items-center justify-center">…</section>`，替换为 `<MessageList />`，并在文件顶部 `import { MessageList } from './MessageList'`。

- [ ] **Step 5: 手动验证（空态）**

Run: `yarn dev`
Expected：空态文案居中；窗口缩放不出现横向滚动。真实消息渲染在 Task 6 用历史会话验证，不在代码里塞 demo 数据。

- [ ] **Step 6: 提交**

```bash
git add src/renderer/src/pages/home
git commit -m "feat(chat): message list with markdown and stick-to-bottom"
```

---

### Task 4: thinking 块与工具卡片

**Files:**

- Create: `src/renderer/src/pages/home/components/Chat/ThinkingBlock.tsx`
- Create: `src/renderer/src/pages/home/components/Chat/ToolCallCard.tsx`

**Interfaces:**

- Consumes: `ToolCallView`
- Produces: `<ThinkingBlock text streaming />`、`<ToolCallCard tool />`

- [ ] **Step 1: `ThinkingBlock.tsx`**

```tsx
import { Brain, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@renderer/lib/utils'

interface ThinkingBlockProps {
  text: string
  streaming?: boolean
}

export function ThinkingBlock({ text, streaming }: ThinkingBlockProps): React.JSX.Element {
  const [open, setOpen] = useState(Boolean(streaming))

  return (
    <div className="border-accent-neutral/20 rounded-lg border">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="text-accent-neutral hover:text-fore flex w-full items-center gap-2 px-3 py-2 text-left text-xs"
      >
        <ChevronRight className={cn('size-3 transition-transform', open && 'rotate-90')} />
        <Brain className="size-3" />
        <span>{streaming ? '思考中…' : '思考过程'}</span>
      </button>
      {open && (
        <pre className="text-accent-neutral max-h-72 overflow-y-auto px-3 pb-3 font-mono text-[11px] whitespace-pre-wrap">
          {text}
        </pre>
      )}
    </div>
  )
}
```

- [ ] **Step 2: `ToolCallCard.tsx`**

```tsx
import { AlertCircle, Check, ChevronRight, Loader2, Wrench } from 'lucide-react'
import { useState } from 'react'
import type { ToolCallView } from '@shared/piProtocol'
import { cn } from '@renderer/lib/utils'

interface ToolCallCardProps {
  tool: ToolCallView
}

export function ToolCallCard({ tool }: ToolCallCardProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const statusIcon =
    tool.state === 'running' || tool.state === 'pending' ? (
      <Loader2 className="text-accent-sky size-3 animate-spin" />
    ) : tool.state === 'error' ? (
      <AlertCircle className="text-accent-rose size-3" />
    ) : (
      <Check className="text-accent-emerald size-3" />
    )

  return (
    <div className="border-accent-neutral/20 bg-card/40 rounded-lg border">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs"
      >
        <ChevronRight className={cn('size-3 transition-transform', open && 'rotate-90')} />
        <Wrench className="text-accent-neutral size-3" />
        <span className="font-mono">{tool.toolName}</span>
        {statusIcon}
        {tool.durationMs !== undefined && (
          <span className="text-accent-neutral ml-auto text-[10px]">{tool.durationMs}ms</span>
        )}
      </button>
      {open && (
        <div className="space-y-2 px-3 pb-3">
          <pre className="text-accent-neutral bg-main/60 overflow-x-auto rounded p-2 font-mono text-[11px] whitespace-pre-wrap">
            {summarizeArgs(tool.args)}
          </pre>
          {tool.preview && (
            <pre className="text-fore/80 bg-main/60 max-h-64 overflow-auto rounded p-2 font-mono text-[11px] whitespace-pre-wrap">
              {tool.preview}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

function summarizeArgs(args: unknown): string {
  if (!args || typeof args !== 'object') return String(args ?? '')
  return JSON.stringify(args, null, 2)
}
```

- [ ] **Step 3: typecheck + 提交**

Run: `yarn typecheck && yarn lint`

```bash
git add src/renderer/src/pages/home/components/Chat
git commit -m "feat(chat): thinking block and tool call cards"
```

---

### Task 5: Composer（发送 / steer / 中断）

**Files:**

- Create: `src/renderer/src/pages/home/components/Chat/Composer.tsx`
- Modify: `src/renderer/src/pages/home/components/Chat/index.tsx`

**Interfaces:**

- Consumes: `window.api.pi.invoke`、`useChatStore`
- Produces: 发送 `prompt`、`abort`；运行中切换 `steer` / `followUp`

- [ ] **Step 1: 写 `Composer.tsx`**

```tsx
import { ArrowUp, Square } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'
import { useChatStore } from '../../store/chat'

type Behavior = 'steer' | 'followUp'

export function Composer(): React.JSX.Element {
  const [text, setText] = useState('')
  const [behavior, setBehavior] = useState<Behavior>('steer')
  const status = useChatStore((state) => state.status)
  const sessionPath = useChatStore((state) => state.sessionPath)
  const running = status === 'running' || status === 'compacting'

  const send = async (): Promise<void> => {
    const value = text.trim()
    if (!value) return
    const result = await window.api.pi.invoke({
      type: 'prompt',
      text: value,
      ...(running ? { behavior } : {})
    })
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    setText('')
  }

  const abort = async (): Promise<void> => {
    const result = await window.api.pi.invoke({ type: 'abort' })
    if (!result.ok) toast.error(result.error)
  }

  return (
    <footer className="shrink-0 px-4 pb-4">
      <div className="bg-card focus-within:border-accent-neutral/50 mx-auto flex max-w-3xl flex-col gap-2 rounded-xl border border-accent-neutral/25 p-2">
        <textarea
          rows={2}
          value={text}
          placeholder={sessionPath ? '给 pi 发消息…' : '先在左侧选择或新建一个会话'}
          disabled={!sessionPath}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              void send()
            }
          }}
          className="placeholder:text-accent-neutral/70 w-full resize-none bg-transparent px-2 py-1 text-sm outline-none disabled:opacity-50"
        />
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="text-accent-neutral text-[11px]">Enter 发送 · Shift+Enter 换行</span>
            {running && (
              <div className="border-accent-neutral/20 flex items-center gap-1 rounded border p-0.5">
                {(['steer', 'followUp'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setBehavior(value)}
                    className={cn(
                      'rounded px-1.5 py-0.5 text-[10px]',
                      behavior === value
                        ? 'bg-card-hover text-fore'
                        : 'text-accent-neutral hover:text-fore'
                    )}
                  >
                    {value === 'steer' ? '引导' : '追问'}
                  </button>
                ))}
              </div>
            )}
          </div>
          {running ? (
            <Button
              size="icon-sm"
              variant="secondary"
              aria-label="中断"
              onClick={() => void abort()}
            >
              <Square />
            </Button>
          ) : (
            <Button
              size="icon-sm"
              aria-label="发送"
              disabled={!sessionPath || !text.trim()}
              onClick={() => void send()}
            >
              <ArrowUp />
            </Button>
          )}
        </div>
      </div>
    </footer>
  )
}
```

- [ ] **Step 2: 用 Composer 替换 Chat 里原有的 footer**

`Chat/index.tsx`：删除原 `<footer>…</footer>`，改为 `<Composer />`；补 import。

- [ ] **Step 3: 手动验证**

Run: `yarn dev`
Expected：

1. 未选会话时输入框禁用，提示文案正确。
2. 新建会话后输入框可用；Enter 发送，Shift+Enter 换行。
3. 运行中显示中断按钮与"引导/追问"切换。

- [ ] **Step 4: 提交**

```bash
git add src/renderer/src/pages/home
git commit -m "feat(chat): composer with send, abort and queue behavior"
```

---

### Task 6: 会话回放与自动滚动联动

**Files:**

- Modify: `src/renderer/src/pages/home/store/projects.ts`
- Modify: `src/renderer/src/pages/home/store/chat.ts`
- Modify: `src/renderer/src/pages/home/components/Chat/index.tsx`

**Interfaces:**

- Consumes: `chatActions.loadMessages`
- Produces: `openSession` 回放历史；`newSession` 设置 `sessionPath`

- [ ] **Step 1: 回放历史**

`store/projects.ts` 的 `openSession` 末尾加：

```ts
const messages = await window.api.pi.invoke({ type: 'messages' })
if (messages.ok) {
  chatActions.loadMessages((messages.data as { messages: unknown[] }).messages)
}
```

`newSession` 里，`start` 成功后取 `state` 并 `chatActions.reset()` + `chatActions.setSession(sessionFile)`：

```ts
const state = await window.api.pi.invoke({ type: 'state' })
if (state.ok) {
  const data = state.data as { sessionFile?: string }
  chatActions.reset()
  chatActions.setSession(data.sessionFile ?? null)
  useProjectsStore.setState({ activeSessionPath: data.sessionFile ?? null })
}
```

- [ ] **Step 2: 发送后本地先清空、失败回填**

把 `Composer.send` 改为：先保存 `value`，失败时 `setText(value)`（目前失败时文本仍在，因为只在成功时清空——确认无需改动；若 `invoke` 抛异常，补 `try/catch` + `toast.error`）。

```ts
try {
  const result = await window.api.pi.invoke({
    type: 'prompt',
    text: value,
    ...(running ? { behavior } : {})
  })
  if (!result.ok) {
    toast.error(result.error)
    return
  }
  setText('')
} catch (error) {
  toast.error(error instanceof Error ? error.message : String(error))
}
```

- [ ] **Step 3: 端到端验证（真实 pi）**

Run: `yarn dev`

1. 添加项目（选 `piper` 仓库）→ 打开一条历史会话 → 历史消息渲染（Markdown、工具卡片）。
2. 新建会话 → 发一条真实消息 → 流式文本、工具卡片、结束后状态回 `空闲`。
3. 运行中点中断 → 状态回 `空闲`，已生成内容保留。
4. 运行中发送并选"引导" → 队列消息进入下一轮。

- [ ] **Step 4: 全量校验并提交**

Run: `yarn typecheck && yarn test && yarn lint && yarn build`

```bash
git add src/renderer/src/pages/home
git commit -m "feat(chat): replay history and wire composer to sessions"
```

---

## 延后项（记录在 ledger，不进本计划）

- 消息列表虚拟化：等真实会话出现明显卡顿再做（`@tanstack/react-virtual` 已装）。
- 图片附件、Markdown 内 Mermaid、代码块复制按钮。
- 工具卡片的语义化摘要（当前展开为 JSON）。
- 运行中队列 chips（需要 `queue_update` 已在 reducer，UI 留 M4）。

## 交付标准（M3 结束时）

- `yarn typecheck` / `test` / `lint` / `build` 全绿。
- 历史会话可读、流式消息可读、工具调用可见、可发送/中断/引导。
- 滚动锚定：用户上翻时不强制回到底部。
