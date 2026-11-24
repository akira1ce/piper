# Piper M6（收尾）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 崩溃后能一键重连，会话可重命名/删除，常用操作有快捷键，空态可用。

**Architecture:** 重连 = 用当前 `cwd` + `sessionPath` 重新 `start` + `get_messages` 回放；重命名走 RPC `set_session_name`；删除由主进程校验路径后 `shell.trashItem`；快捷键在页面层用 `react-hotkeys-hook`。

**Spec:** `docs/superpowers/specs/2026-11-24-piper-v1-design.md`

## Global Constraints

- 分支 `feat/m6-polish`，fork 自 `main`。
- 打包方案（内置 pi vs 系统安装）**暂不处理**，留到发版前。
- 删除只允许 `sessionsDir` 之内的 `.jsonl`，其它路径一律拒绝。
- `yarn typecheck` / `test` / `lint` / `build` 全绿。

---

### Task 1: 会话删除命令（主进程校验）

**Files:** `src/shared/piProtocol.ts`、`src/main/ipc.ts`、`src/main/pi/sessionIndex.ts`(导出 `resolveSessionsDir` 已有)、测试 `src/main/ipcPaths.test.ts`

**Interfaces:**

- `PiCommand` 增加 `{ type: 'deleteSession'; sessionPath: string }`
- 新增纯函数 `isInsideSessionsDir(sessionPath, sessionsDir): boolean`

- [ ] 写测试：目录内 `.jsonl` 通过；`..` 逃逸、非 jsonl、目录外路径拒绝
- [ ] 实现 `src/main/ipcPaths.ts`，`ipc.ts` 加白名单与路由（`shell.trashItem`，失败返回错误）
- [ ] `yarn test` + commit `feat(session): guarded session deletion`

---

### Task 2: 重连与回放

**Files:** `pages/home/store/chat.ts`、`pages/home/components/Chat/index.tsx`

**Interfaces:**

- `ChatView.cwd: string | null`
- `chatActions.reconnect(): Promise<void>`；`chatActions.setContext(cwd, sessionPath)`

- [ ] store 增加 `cwd`；`openSession`/`newSession` 调 `setContext`
- [ ] `reconnect`：`start {cwd, sessionPath}` → `state` → `messages` → `loadMessages`，失败写 banner
- [ ] 错误 banner 右侧加"重连"按钮（仅 `status==='error'` 且有 session）
- [ ] `yarn typecheck` + commit `feat(chat): reconnect and replay after crash`

---

### Task 3: 重命名 / 删除入口

**Files:** `pages/home/components/Chat/SessionActions.tsx`、`Chat/index.tsx`、`pages/home/store/projects.ts`

- [ ] `SessionActions`：头部放铅笔/垃圾桶按钮；Radix Dialog 输入新名（重命名）、确认删除
- [ ] 重命名：`invoke({type:'renameSession', name})` → `projectActions.load()`
- [ ] 删除：`invoke({type:'deleteSession', sessionPath})` → `chatActions.reset()` → `projectActions.load()`
- [ ] 无活跃会话时按钮不显示
- [ ] `yarn typecheck && lint` + commit `feat(chat): rename and delete session`

---

### Task 4: 快捷键与空态

**Files:** `pages/home/index.tsx`、`pages/home/components/Sider/index.tsx`、`pages/home/store/projects.ts`

- [ ] `projectActions.activeProject()`：按 `activeSessionPath` 反查，否则第一个可用项目
- [ ] `mod+b` 折叠侧栏；`mod+n` 新会话（有可用项目时）；`mod+shift+d` 切换 diff 面板
- [ ] 侧栏空态：说明文字 + "添加项目"按钮（已有按钮，补文案）
- [ ] 手动验证快捷键不干扰输入框（`enableOnFormTags: false` 默认）
- [ ] `yarn typecheck && lint` + commit `feat(ui): shortcuts and empty states`

---

### Task 5: 验证

- [ ] `yarn typecheck && yarn test && yarn lint && yarn build`
- [ ] 手动：kill pi 进程 → 状态变"连接异常" → 点重连 → 历史回来
- [ ] 手动：重命名会话 → 侧栏与标题更新；删除会话 → 列表消失且文件进回收站
