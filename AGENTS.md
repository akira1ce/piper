# AGENTS.md

Piper 是 pi 的 GUI 客户端（Electron + React + Tailwind + Radix + zustand）。
本文件只记录会反复影响实现决策的约定；细节以被引用的文件为准，不在此复述。

## 进程边界

- 渲染进程不碰 Node：没有 fs / child_process / 原始 ipcRenderer。
- 需要主进程能力时，走 preload 暴露的白名单 API。
- 跨进程的协议类型（`PiCommand` / `DomainEvent` / `Project` 等）只放 `src/shared`，main、preload、renderer 都从这里引用。

## 目录与页面

- 页面放 `src/renderer/src/pages/<page>`（`home`，后续 `settings`），页面入口是 `index.tsx`。
- 页面目录内按需建：`components/`（该页面的组件）、`controller/`（单向数据转化）、`util/`、`constant/`、`store/`（仅页面内共享的状态）。没有内容的目录不预建。
- `sider` 这类是 `home` 的组件，不是独立模块，放 `pages/home/components/`。
- 跨页面复用的组件才进 `src/renderer/src/components`；shadcn 组件只放 `components/ui`。
- 跨页面共享的状态才进 `src/renderer/src/store`。
- 页面内部实现不外传：其他页面只通过页面入口文件使用它，不直接 import 内部文件。
- 样式分片放 `src/renderer/src/styles`，由 `main.css` 统一 `@import`；markdown/prose 这类模块样式单独成文件，不揉进主 css。

## 命名

- 不使用短横线命名。
- 组件 `PascalCase.tsx`，组件目录与组件同名；hook `useXxx.ts`；store / 工具 / controller `camelCase.ts`。

## 状态

- 优先级：组件内 `useState` → 页面 `store` → 全局 `store`。不要什么状态都放 zustand。
- 参考 `zustand.md`：`create()` 只定义 state；action 放在外部的 `xxxActions` 对象里用 `setState` 定义。
- action 必须能在组件外调用（测试、IPC 回调、主进程消息）。

## 数据转化

- `controller/` 只做单向转化，方向固定为 **xxx → view**：把领域数据（pi 事件、协议消息、store 数据）转成视图直接可用的数据，不反向回写、不持有 UI 状态。
- 组件只消费转化后的视图数据，不解析协议原始字段。

## Tailwind

- 颜色只用语义 token：`bg-main` / `text-fore` / `bg-card` / `bg-card-hover` / `accent-*`，不写死色值。
- 边框优先用 `surface-border` / `surface-border-emphasis`。
- 不为"少写几个字符"抽 utility 类；复用通过封装组件实现。
- 全局行为（滚动条、view-transition、字体）放 `main.css` 的全局层。

## UI 组件与样式边界

- shadcn 组件只放 `components/ui`，用 `npx shadcn add <name>` 拷入，不跑 `shadcn init`。
- shadcn 语义 token（`bg-background`、`text-muted-foreground` 等）只允许出现在 `components/ui`。
- `pages/` 与其余 `components/` 只用 Piper token（`bg-main`、`text-fore`、`bg-card`、`accent-*`）。
- 语义变量映射只在 `styles/shadcn.css` 维护；改色只改 `theme/tokens.css`。
- 模块样式默认用 utility；需要原生 css 时建 `styles/modules/<page>.css`，并在 `main.css` 里 import。
- 动画只用 `tw-animate-css` 的 utility，不在业务组件里写 `@keyframes`。

## 不要做

- 过度抽象：没有第二个使用场景前不建抽象层。
- 跨页面直接 import 页面内部文件（绕过页面入口）。
- 短横线命名。
- 写死色值（用 token）、在业务组件里写 `@keyframes`。
