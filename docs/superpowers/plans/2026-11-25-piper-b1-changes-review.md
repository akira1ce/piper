# Piper B1 实施计划（本轮变更 + 审阅）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** assistant 回复展示本轮改动；点审阅在右侧看 diff（多文件支持文件树 + 单文件）。

**Spec:** `docs/superpowers/specs/2026-11-25-piper-b1-turn-changes-design.md`

## Global Constraints

- 分支 `feat/b1-changes`，fork 自 `main`。
- 不实现撤销；不统计 bash 产生的改动。
- 颜色只用 token；新增 CSS 进 `styles/modules/`。
- `yarn typecheck` / `test` / `lint` / `build` 全绿。

### Task 1: 变更模型与解析

**Files:** `src/shared/piProtocol.ts`、`pages/home/controller/changes.ts`(+test)

**Interfaces:**

- `FileChange`、`TurnChanges`；`MessageView.changes?: TurnChanges`
- `parsePatch(patch): PatchLine[]`、`countPatch(patch)`、`pathFromPatch(patch)`、`changeFromEdit(result)`、`changeFromWrite(args)`、`relativizePath(path, cwd)`、`mergeChanges(files, change)`、`summarizeChanges(files)`

- [ ] 写测试：`+/-` 计数排除文件头；`write` 生成全新增 patch；绝对路径相对化；同路径合并累计计数
- [ ] 实现并 `yarn test` 通过
- [ ] commit `feat(changes): parse tool diffs into turn changes`

### Task 2: 实时聚合到消息

**Files:** `pages/home/controller/reducePiEvent.ts`(+test)

- [ ] 测试：`tool_start`(edit,args) + `tool_end`(details.patch) → 最后一条 assistant.changes；新 assistant 不继承；`write` 用 args.content
- [ ] 实现：需要 `cwd`（`ChatView.cwd`）做相对化；`tool_end` 里按 `toolName` 分派
- [ ] commit `feat(changes): attach turn changes to assistant messages`

### Task 3: 回放聚合

**Files:** `pages/home/controller/messagesToView.ts`(+test)、`store/chat.ts`

- [ ] 测试：assistant toolCall + toolResult(details.patch) → changes；`write` 用 args.content；`cwd` 相对化
- [ ] 实现：`messagesToView(raw, { cwd })`，`loadMessages` 传当前 `cwd`
- [ ] commit `feat(changes): rebuild turn changes when replaying history`

### Task 4: 项目文件索引

**Files:** `src/main/fileIndex.ts`(+test)、`src/main/ipc.ts`、`src/shared/piProtocol.ts`

- [ ] 测试：git 仓库列已跟踪+未跟踪；非 git 递归忽略目录；上限截断
- [ ] 实现 `listProjectFiles(cwd)`，IPC `{ type: 'files' }`（用当前会话 cwd 或传入 cwd）
- [ ] commit `feat(files): project file index for review and mentions`

### Task 5: 变更卡片与审阅状态

**Files:** `components/Chat/ChangeSummaryCard.tsx`、`store/review.ts`、`store/chat.ts`(close on context switch)、`components/Chat/MessageItem.tsx`

- [ ] review store：`open(changes, path?)`、`select(path)`、`close()`
- [ ] 卡片：标题/计数/文件行/审阅按钮；点击行打开 review
- [ ] `MessageItem` 在 assistant blocks 之后渲染卡片
- [ ] 会话切换时 `reviewActions.close()`
- [ ] commit `feat(changes): per-turn change card with review action`

### Task 6: 审阅面板与 diff 渲染

**Files:** `components/ViewDiff/index.tsx`、`components/ViewDiff/{FileTree,DiffLines}.tsx`、`controller/fileTree.ts`(+test)、`styles/modules/diff.css`

- [ ] `buildTree(paths, changed)` + 测试（嵌套、排序）
- [ ] `DiffLines`：解析 patch → 行号/底色/`@@` 头
- [ ] 面板：单文件直接展示；多文件左列（>3 用项目树，否则变更列表），右列单文件 diff；无变更文件提示
- [ ] 打开面板时拉取 `files`（失败则仅列表）
- [ ] 手动验证 + 全量检查 + commit
