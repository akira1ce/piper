# Piper B1：本轮变更卡片 + 审阅面板

日期：2026-11-25
状态：待执行

## 目标

- 每个 assistant 回合结束时，如果产生文件改动，在回复尾部显示一张变更卡片（文件数、+/-、文件列表、"审阅"）。
- 点"审阅"打开右侧 diff 面板：单个文件直接看；多个文件时左侧（项目文件树 / 变更列表）右侧单个文件 diff。
- 不实现撤销（pi 无 undo API，快照方案另立）。

## 数据来源（已验证真实会话）

- `edit` 工具：toolCall 参数 `{ path, edits }`；toolResult `details.patch`（unified diff）与 `details.diff`（带行号上下文）。
- `write` 工具：toolCall 参数 `{ path, content }`；toolResult 无 diff，用 content 生成"全新增" patch。
- `bash` 产生的文件改动无法可靠检测，**不纳入**（卡片只统计 edit/write）。

## 数据模型（`src/shared/piProtocol.ts`）

```ts
export interface FileChange {
  path: string // 相对项目根；无法相对化时保留绝对路径
  status: 'modified' | 'created'
  additions: number
  deletions: number
  patch: string // unified diff；renderer 直接解析
}

export interface TurnChanges {
  files: FileChange[]
  additions: number
  deletions: number
}
```

`MessageView` 增加可选 `changes?: TurnChanges`（仅 assistant）。

## 聚合规则

- **实时**：`tool_end` 事件携带 `result.details.patch`；用 `view.toolCalls[id]` 里的 args/name 判断 edit/write，把 `FileChange` 合并进"最后一条 assistant 消息"的 `changes`。同一文件多次编辑合并为一条（保留最后一次 patch 与累计计数？——取该文件累计 +/- 并保留最后 patch，v1 简化：按出现顺序各算一条，同路径累加计数、patch 取最后）。
- **回放**：`messagesToView` 遍历 assistant 消息收集 toolCall（id→{name,args}）与随后的 toolResult，生成同样的 `changes`。需要 `cwd` 做相对化。
- 计数：patch 中 `+`/`-` 行数，排除 `+++`/`---`。
- 路径：patch 头 `+++ b/...` 或 `--- a/...` 优先；否则用 toolCall 的 `path`；`write` 的绝对路径按 `cwd` 相对化。
- 无 patch/二进制：跳过该文件，不阻塞其他变更。

## UI

**ChangeSummaryCard**（assistant 消息尾部）

- 标题：全部 created → "已创建 N 个文件"，否则 "已编辑 N 个文件"；右侧 `+A`（emerald）`-B`（rose）与"审阅"按钮。
- 文件行：路径 + `+A -B`；点击直接打开该文件 diff。
- 样式：`border-accent-neutral/20` 圆角卡片，非 shadcn 组件。

**审阅面板（ViewDiff）**

- 状态：`store/review.ts` → `{ changes: TurnChanges | null; selectedPath: string | null }`。
- 无 changes：保留"还没有文件变更"占位。
- 单文件：直接渲染 diff。
- 多文件（>1）：左列文件导航，右列单个 diff；文件数 > 3 时左列使用**项目文件树**（目录可折叠，变更文件高亮并带 +/-），否则使用变更文件平铺列表。点击无变更文件显示"本轮无变更"。
- diff 渲染：解析 unified patch → 行号（旧/新）+ 增删底色 + 等宽字体；`@@` 头单独一行弱化显示。不做逐 token 语法高亮（后续用 Shiki）。

## 项目文件索引（B1 需要，B2 复用）

- IPC `{ type: 'files' }`：主进程按当前会话 `cwd` 返回 `{ root, files: string[] }`（相对路径）。
- git 仓库：`git ls-files -co --exclude-standard`（已跟踪 + 未跟踪但未忽略）。
- 非 git：递归遍历，忽略 `node_modules/.git/dist/out/.next/coverage/.venv` 等，文件数上限 5000。
- 缓存：`(cwd, mtime?)` 简单内存缓存 30s；失败返回空列表 + 错误信息。

## 错误处理

- patch 解析失败：该文件标记为"无法显示 diff"，仍出现在列表与计数（计数为 0）。
- 文件索引失败：面板降级为"仅变更文件列表"。
- 审阅目标随会话切换清空（打开/新建会话时 `reviewActions.close()`）。

## 测试

- `changes.ts`：patch 解析/计数/路径相对化/写入 patch 生成/同路径合并。
- reducer：`tool_end` 附加到当前 assistant；新 assistant 重置；`settled` 后保留。
- `messagesToView`：回放生成 changes，toolResult details 正确归位。
- `fileIndex`：git 与非 git 分支（临时目录 + mock exec）。
- `buildTree`：目录嵌套、排序、变更标记。
