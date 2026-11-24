# Piper M5（模型与扩展 UI）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 会话元信息可控（模型 / thinking）、扩展对话框与通知能在 GUI 中正常工作。

**Architecture:** 模型与 thinking 由 `state`/`models`/`thinkingLevels` 三个命令初始化，选择时调 `setModel`/`setThinkingLevel`；扩展 UI 走 `extension_ui` 事件进 store，应答走 `extensionRespond`。副作用（toast / 标题）只在 `usePiBridge` 处理。

**Spec:** `docs/superpowers/specs/2026-11-24-piper-v1-design.md`

## Global Constraints

- 分支 `feat/m5-models`，fork 自 `main`。
- 不新增运行时依赖（`radix-ui` 与 `cmdk` 已在）。
- 颜色只用 token；`pages/` 不写 shadcn 变量名。
- `yarn typecheck` / `test` / `lint` / `build` 全绿。

---

### Task 1: 元信息与扩展状态

**Files:** `src/shared/piProtocol.ts`、`pages/home/controller/reducePiEvent.ts`(+test)、`pages/home/store/chat.ts`

**Interfaces:**

- `ExtensionUiRequest` 增加 `statusKey?`、`statusText?`
- `ChatView` 增加 `model: ModelInfo | null`、`modelList: ModelInfo[]`、`thinkingLevels: ThinkingLevel[]`、`dialogs: ExtensionUiRequest[]`、`extensionStatus: string | null`
- `chatActions.loadMeta()`、`setModel(provider, id)`、`setThinkingLevel(level)`、`respondExtension(id, payload)`

- [ ] 写失败测试：`extension_ui` 的 `select` 进入 `dialogs`；`setStatus` 写 `extensionStatus`；重复 id 不重复入队
- [ ] 实现 reducer 分支与初始值
- [ ] 实现 store actions（`loadMeta` 用 `Promise.all` 取 `state`/`models`/`thinkingLevels`；`setModel` 成功后 `loadMeta`）
- [ ] `yarn test` 通过，commit `feat(chat): session meta and extension dialog state`

---

### Task 2: Popover 基础设施

**Files:** `src/renderer/src/components/ui/popover.tsx`

**Interfaces:** `Popover`、`PopoverTrigger`、`PopoverContent`

- [ ] 用 `radix-ui` 的 `Popover` 写 shadcn 风格包装（`bg-popover border-border`，`z-50`，`sideOffset=4`）
- [ ] `yarn typecheck` + commit `feat(ui): popover primitive`

---

### Task 3: 模型与 thinking 选择器

**Files:** `pages/home/components/Chat/ModelPicker.tsx`、`ThinkingPicker.tsx`、`Chat/index.tsx`

- [ ] `ModelPicker`：Popover + `cmdk`（`shouldFilter={false}` + 本地 `includes` 过滤），列出 `provider/id`，选中后 `chatActions.setModel`
- [ ] `ThinkingPicker`：Popover 列出 `thinkingLevels`，当前项高亮，选中后 `chatActions.setThinkingLevel`
- [ ] Chat 状态条：`空闲` 右侧依次放 `ModelPicker`、`ThinkingPicker`、`StatsBar`
- [ ] `sessionPath` 变化时 `chatActions.loadMeta()`
- [ ] `yarn typecheck && yarn lint`，commit `feat(chat): model and thinking pickers`

---

### Task 4: 扩展对话框与副作用

**Files:** `pages/home/components/Chat/ExtensionDialog.tsx`、`controller/usePiBridge.ts`、`Chat/index.tsx`

- [ ] `ExtensionDialog`：Radix Dialog；`select` 选项按钮、`confirm` 取消/确定、`input` 单行、`editor` 多行（`prefill`）；提交走 `chatActions.respondExtension`
- [ ] `timeout`：本地倒计时，到期发送 `cancelled` 并移除
- [ ] `usePiBridge`：`notify` → `toast[notifyType](message)`；`setTitle` → `document.title`
- [ ] Chat 挂载 `<ExtensionDialog />`
- [ ] `yarn typecheck && yarn lint`，commit `feat(chat): extension dialogs, notify and title`

---

### Task 5: 验证

- [ ] `yarn typecheck && yarn test && yarn lint && yarn build`
- [ ] 真实会话：打开后头部显示模型；切换 thinking 后 `thinking_level_changed` 同步；状态条显示扩展 `setStatus`（可选，若扩展提供）
- [ ] 手动/单元覆盖扩展应答（无扩展时用单测覆盖 reducer）

## 延后项

- 模型分页/收藏、thinking 说明文案。
- `setWidget` / `set_editor_text`（RPC 模式无意义）。
