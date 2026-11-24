# Piper v1 设计（A 阶段：Chat-first）

日期：2026-11-24
状态：待评审

## 1. 目标与边界

Piper 是 pi 的 GUI 客户端。v1 只做 **A：Chat-first**，目标是让 pi 的会话在桌面端可用：

- 左侧两级导航：**项目列表 → 项目内会话**
- 添加项目（选目录）、重命名/移除项目、项目内新建会话
- 会话浏览、恢复、切换
- 流式对话：文本、thinking、工具调用卡片
- 中断、steer / follow-up 排队
- 模型与 thinking 级别切换
- 自动重试、压缩、扩展弹窗的状态可见
- 崩溃后可恢复

**非目标（留给 B 阶段）**：diff 视图、文件树、`@file` 提及、内嵌终端、代码编辑器、多窗口、light 主题、扩展 `custom()`、图片附件。

## 2. 关键决策

| 决策           | 选择                                                                               | 理由                                                                                                 |
| -------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 与 pi 的集成   | RPC 子进程（`pi --mode rpc`），自研薄客户端                                        | pi 崩溃不带走 UI；与 CLI 行为完全一致；不把 pi 及原生依赖装进 Electron 主进程                        |
| pi 来源        | 系统安装的 `pi`；`PIPER_PI_PATH` 可覆盖                                            | 避免随包分发 27MB+ 的 pi；pi 升级与 CLI 保持一致（node 依赖本来就由 pi 自身引入）                    |
| 协议客户端     | 自研 `PiClient`（约 200 行），不用 SDK 的 `RpcClient`                              | 为用 `RpcClient` 需把整个 pi SDK（27MB）作为运行时依赖；其分帧语义可照抄，其余按我们的白名单重写更短 |
| 会话列表       | 自研只读 `SessionIndex` 解析 `~/.pi/agent/sessions/**/*.jsonl`                     | 避免引入 SDK；格式稳定且有 `version` 守卫；解析失败只降级不阻塞                                      |
| 项目归属       | 项目列表由 Piper 维护（`userData/projects.json`），会话按 header 的 `cwd` 归属项目 | 不污染 pi 配置；一个 cwd 可对应多个会话，与 pi 的存储结构一致                                        |
| 事件归一化位置 | 主进程只做协议/批处理；**renderer 的 `controller/` 做 xxx → view**                 | 符合 AGENTS.md 的单向转化约定，主进程保持无业务语义                                                  |
| 并发会话       | v1 只允许一个活跃 pi 进程                                                          | 切会话/换目录语义清晰，资源可控；并行任务留到 B                                                      |
| 主题           | dark only                                                                          | v1 减负；token 已预留 light 结构                                                                     |
| 新增依赖       | `cross-spawn`（Windows 的 `.cmd`）、`vitest`（dev，纯函数测试）                    | 不引入 pi SDK，保持运行时依赖最小                                                                    |

## 3. 进程与模块结构

```
main (Node)                                  renderer (sandbox)
├─ pi/piProcess.ts   spawn/stop、严格分帧、背压   ├─ pages/home/
├─ pi/piClient.ts    id 关联、超时、命令封装      │  ├─ controller/reducePiEvent.ts  纯 reducer
├─ pi/piGateway.ts   单连接、事件批处理、IPC       │  ├─ controller/usePiBridge.ts    订阅 + 派发
├─ pi/sessionIndex.ts 只读会话索引                │  ├─ store/chat.ts                view model
├─ ipc.ts            命令白名单 + 事件广播        │  ├─ store/projects.ts            项目/会话列表
├─ settings.ts       userData 配置                │  └─ components/{Sider,Chat,ViewDiff}
└─ projects.ts       项目注册表                   └─ shared/piProtocol.ts  共享类型
preload: 只暴露 api.pi.invoke / api.pi.onEvent / api.platform
```

新增 `src/shared/`，给 main / preload / renderer 共用协议类型；`tsconfig.node.json`、`tsconfig.web.json` 与 `electron.vite.config.ts` 各加一条 `@shared` 别名。

## 4. 数据流（单向）

```
用户操作 → renderer 调用 api.pi.invoke(command)
        → main 校验白名单 → pi stdin (JSONL)
pi stdout (JSONL) → main 解析 + 批处理(30ms) → webContents.send('pi:event', batch)
        → renderer controller.reducePiEvent(batch) → store → 组件渲染
```

- renderer 拿不到原始 RPC 记录，只能拿到 `DomainEvent`。
- 任何组件都不直接调用 `window.api`，统一走 `controller/`。
- 反向只有两类：命令（invoke）、扩展弹窗应答。

## 5. RPC 客户端规则（`piProcess.ts` + `piClient.ts`）

**启动**：

1. 解析 pi 可执行文件：`PIPER_PI_PATH` → PATH 中的 `pi` → 报错（UI 给出安装命令）。
2. 执行 `pi --version` 做兼容检查：可解析且 ≥ `1.6.0` 才继续；否则警告并允许用户强制继续（协议以本 spec 为准）。
3. `spawn(piPath, ['--mode', 'rpc', ...(sessionPath ? ['--session', sessionPath] : [])])`，`cwd` 为会话工作目录，`shell: false`；Windows 用 `cross-spawn` 处理 `.cmd`，环境继承 `process.env`。

版本检查结果随 `start` 返回值给 renderer，状态条展示警告，不阻断已经建立的会话。

**分帧（必须按此实现）**：

- 只按 `\n` 切分；容忍行尾 `\r`。
- 禁止 `node:readline`（会按 `U+2028`/`U+2029` 切分）。
- 用流式 `TextDecoder` 处理跨 chunk 的多字节字符。
- 单行上限 16MB，超限丢弃并上报 `protocolError`，防止超大工具输出打爆内存。
- stdout 持续读取；stdin 写入等待 `drain`，遵守背压。

**命令**：每条命令带自增 `id`；`response` 按 `id` 关联；所有命令默认 30s 超时（`prompt` 不设超时，`abort` 10s）。进程退出时拒绝所有 pending，并附带 stderr 尾部 20 行。

**进程生命周期**：

- 退出（非主动停止）→ 广播 `process_exit`，renderer 显示可恢复错误条。
- 重连：用 `--session <sessionFile>` 重启，再 `get_messages` 回放重建 view model。
- 应用退出：先关闭 stdin 等退出，5s 后 SIGTERM，再 2s 后 SIGKILL。

## 6. IPC 契约

`preload` 暴露：

```ts
window.api.pi = {
  invoke(command: PiCommand): Promise<Result>
  onEvent(listener: (batch: { seq: number; events: DomainEvent[] }) => void): () => void
}
```

`PiCommand`（白名单，其他一律拒绝）：

```ts
type PiCommand =
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
```

`Result = { ok: true; data: unknown } | { ok: false; error: string }`。主进程捕获所有异常，渲染进程永远拿到结构化结果。

- `sessions` / `projects` / `addProject` / `removeProject` / `renameProject` / `pickDirectory` 由主进程直接处理，不经过 pi 进程。
- `addProject` 在主进程内打开目录选择框，返回规范化后的项目；渲染进程不接触文件系统。
- 其余命令在转发前做字段校验（类型、必填、枚举值）；`start` 校验 cwd 存在且是目录。
- 已存在活跃进程时收到 `start`：先按正常流程停止旧进程，再启动新进程。

**事件批处理**：主进程按 30ms 合并连续事件；`message_end`、`agent_settled`、`process_exit` 立即刷新，保证语义边界不被延迟。每批带单调 `seq`，renderer 记录 `lastSeq`，**只接受 `seq > lastSeq` 的批次**（重复或乱序直接丢弃）。

## 7. 领域事件

```ts
type DomainEvent =
  | { type: 'agent_start' | 'turn_start' }
  | { type: 'agent_end'; willRetry: boolean }
  | { type: 'settled'; aborted: boolean }
  | { type: 'message_start'; message: AgentMessage }
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
  | { type: 'message_end'; message: AgentMessage }
  | { type: 'tool_start'; toolCallId: string; toolName: string; args: unknown }
  | { type: 'tool_update'; toolCallId: string; partialResult: unknown }
  | { type: 'tool_end'; toolCallId: string; result: unknown; isError: boolean; durationMs?: number }
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
```

`controller/reducePiEvent.ts` 是纯函数：`(viewModel, batch) => viewModel`。

协议事件到领域事件的映射：`message_update.text_delta` / `thinking_delta` / `toolcall_delta` → `delta`；`text_end` / `thinking_end` / `toolcall_end` → `block_end`；`tool_execution_*` → `tool_*`；`agent_settled` → `settled`；`queue_update` → `queue`；`thinking_level_changed` → `thinking_changed`；`session_info_changed` → `session_info`；`compaction_*` / `auto_retry_*` / `summarization_retry_*` 合并为 `compaction` / `retry`；`extension_ui_request` → `extension_ui`；`extension_error` → `extension_error`。

规则：

- 文本/thinking 按 `contentIndex` 追加，`block_end` 用权威内容覆盖。
- `toolcall_start/delta/end` 只用于展示"正在生成参数"，最终以 `tool_execution_*` 为准。
- `message_end` 用权威消息替换流式占位。
- `agent_end` 不等于结束：只有 `settled` 才把会话标记为空闲。
- 工具卡片以 `toolCallId` 关联 `start → update → end`，缺 `end` 的保持"运行中"直到 `settled`。
- 重试/压缩只更新状态条，不改消息内容。

## 8. 项目与会话

**项目注册表**（Piper 自己的数据，不写 pi 配置）：`{ id, path, name, addedAt }`，落 `userData/projects.json`，由 `projects.ts` 管理，`settings.ts` 只负责读写文件。

- 添加项目：`dialog.showOpenDialog({ properties: ['openDirectory'] })` → `realpath` 规整 → 去重（macOS 大小写不敏感）→ 写入列表。目录不存在或重复时提示，不落库。
- 项目名默认取目录名，可重命名（只改显示名，不碰磁盘）。
- 移除项目：只从列表移除，**不删会话文件**；确认弹窗写明。
- 目录失效：标记为 `unavailable`，禁用"新会话"，提供重新定位 / 移除。

**会话归属**：解析 session header 的 `cwd`，与项目路径匹配后归入该项目；不属于任何项目的会话不进侧栏（避免噪音）。项目内按文件 `modified` 降序。

**左侧两级结构**（Codex 式）：

```
▾ piper                    ← 项目（可折叠，hover 出"+ 新会话"）
  · 重构 RPC 客户端         ← 会话（session_info.name 或首条 user 消息摘要）
  · 调 diff 视图
▸ another-project
+ 添加项目
```

- 新会话：切到该项目（必要时重启进程到 `project.path`）→ `new_session`；收到 `session_info` 或首次 `get_state` 后出现在列表顶部。
- 打开会话：同项目 → `switch_session`；跨项目 → 停进程，用目标 `cwd` + `--session` 重启，再 `get_state` + `get_messages`。
- 启动后 `get_state` 初始化 `model` / `thinkingLevel` / `sessionPath`；`models`、`thinkingLevels` 供选择器使用。
- 会话名：`session_info.name` 优先，否则首条 user 消息截断；重命名走 `set_session_name`。
- 会话删除：v1 不做（M6 之后用 `shell.trashItem`，带确认）。
- 索引缓存：按 `(path, mtime, size)` 缓存解析结果；首次扫描并发上限 8，不阻塞 UI；由"添加项目 / 新建 / 切换 / 重命名"触发刷新。

## 9. 扩展 UI

- 对话框：`select` / `confirm` / `input` / `editor` → Radix Dialog，支持 `timeout` 时显示倒计时并在到期后本地关闭（标记为已超时，pi 侧会自行解析），避免悬挂遮罩。
- 通知类：`notify` → sonner；`setTitle` → 主进程直接设窗口标题；`setStatus` 由主进程转发给 renderer 的状态条；`setWidget` / `set_editor_text` 忽略并记录日志（v1）。
- 未应答的对话框在进程退出时标记为取消。

## 10. 页面状态

`pages/home/store/chat.ts`：

```ts
interface ChatView {
  status: 'idle' | 'running' | 'compacting' | 'reconnecting' | 'error'
  sessionPath: string | null
  model: ModelInfo | null
  thinkingLevel: ThinkingLevel
  messages: MessageView[] // 已完成的 + 流式占位
  toolCalls: Record<string, ToolCallView>
  queue: { steering: string[]; followUp: string[] }
  dialogs: ExtensionDialog[]
  banner: { kind: 'error' | 'info'; text: string } | null
}
```

```ts
interface MessageView {
  id: string
  role: 'user' | 'assistant'
  blocks: Array<
    | { kind: 'text'; text: string; streaming: boolean }
    | { kind: 'thinking'; text: string; streaming: boolean }
    | { kind: 'tool'; toolCallId: string }
  >
}

interface ToolCallView {
  toolCallId: string
  toolName: string
  args: unknown
  state: 'pending' | 'running' | 'done' | 'error'
  preview: string // 由 partialResult 截断后的展示文本
  durationMs?: number
}

interface ExtensionDialog {
  id: string
  method: 'select' | 'confirm' | 'input' | 'editor'
  title: string
  message?: string
  options?: string[]
  prefill?: string
  timeout?: number
}
```

- 组件内 `useState`：输入框草稿、折叠状态、hover。
- 页面 store：`chat.ts`（会话视图）+ `projects.ts`（项目列表、会话列表、选中项）。
- 顶层 store：暂无（v1 没有跨页面状态）。
- 重连回放：先进入 `reconnecting` 并**暂停应用事件批**；`get_messages` 返回后重建消息列表，把 `lastSeq` 设为暂停期间收到的最大 `seq` 并丢弃这些批次（已完成消息已在快照里，流式中的消息由后续 `delta` 重建占位、`message_end` 覆盖）。

## 11. 错误处理

| 场景                             | 行为                                                  |
| -------------------------------- | ----------------------------------------------------- |
| 找不到 `pi`                      | 空态 + 安装命令 + 重试按钮                            |
| 启动失败 / 非零退出              | 错误条显示 stderr 尾部，提供"重连"                    |
| 协议解析失败                     | 记录并继续；连续 5 次则标记连接异常                   |
| 命令超时/失败                    | toast + 命令级回滚（例如模型切换失败保留原值）        |
| prompt 被拒绝（`success:false`） | 输入内容保留在 composer，显示原因                     |
| 运行中再次发送                   | 必须选 steer/follow-up；composer 提供切换，默认 steer |
| abort                            | 状态回到 idle，保留已生成内容                         |

## 12. 测试

- 单元（vitest，测试文件与实现同目录 `*.test.ts`）：
  - `piProcess`：分帧（跨 chunk、CRLF、字符串内 `U+2028`、超长行）、背压、退出清理。
  - `piGateway`：30ms 合并、语义边界立即刷新、`seq` 单调。
  - `reducePiEvent`：文本流、工具生命周期、abort、重试、压缩、扩展弹窗、乱序/重复批次丢弃。
  - `sessionIndex`：用 fixture 目录覆盖 v2/v3、缺 name、损坏行、排序、按 `cwd` 归属项目（含大小写、尾斜杠差异）。
  - `projects`：添加去重、移除不删文件、失效目录标记。
- 集成（可选）：真实 `pi --mode rpc --no-session` 跑 `get_state` / `get_available_models`（不触发模型调用），`pi` 不存在时 skip。
- 手工验收：启动 → 打开目录 → 新建会话 → 发消息 → 看到文本/工具卡片 → steer → abort → 崩溃恢复 → 改名 → 切换会话。

## 13. 里程碑

1. **M1 网关**：vitest 基座、`PiClient` + `PiGateway` + IPC + 错误上报；用 `get_state` 打通端到端。
2. **M2 项目与会话**：`projects.json`、添加/重命名/移除项目、`SessionIndex` 按项目分组、新建/切换/恢复、目录失效态。
3. **M3 对话**：消息流、工具卡片、thinking、composer、abort。
4. **M4 队列与状态**：steer/follow-up、队列展示、重试/压缩状态条、统计。
5. **M5 模型与扩展**：模型/thinking 选择器、扩展弹窗、通知。
6. **M6 收尾**：重连与回放、重命名、空态、快捷键、手工验收。

每个里程碑结束跑 `yarn typecheck`、`yarn test`、`yarn build`，M3 起加一次真实 pi 手动验证。

## 14. 待确认

1. **pi 来源**：v1 采用系统安装；如果要分发成品安装包，需要在 B 阶段前决定随包侧车方案（否则用户机器必须有 node）。
2. **附件/图片**：RPC 的 `images` 字段已支持，v1 不做 UI。
3. **会话删除**：`shell.trashItem` 移入回收站，v1 只做重命名，删除放到 M6 之后。
4. **项目排序**：v1 按添加时间；拖拽排序留到后续。
