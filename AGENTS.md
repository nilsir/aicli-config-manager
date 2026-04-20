# AGENTS.md

本文件为 AI 编码助手提供项目协作指南。

## 项目概述

AI CLI Config Manager 是一个本地 Web 应用，用于读取本机文件系统上的 AI CLI 配置文件并在仪表盘中展示。Bun 后端 + React 前端，单体仓库结构。

## 关键约定

### 架构

- 后端是纯 Bun HTTP 服务器，不使用 Express/Hono 等框架
- 每个 CLI 工具对应一个独立的 reader 文件（`server/readers/*.ts`）
- 所有 reader 返回统一的 `CLIConfig` 类型（定义在 `server/types.ts`）
- 前端使用 Vite 开发服务器，通过 proxy 转发 `/api/*` 到 3030 端口
- 生产模式下由 Bun 服务器直接托管 `web/dist/` 静态文件

### 添加新的 CLI 支持

1. 在 `server/readers/` 下新建文件，导出 `async function readXxxConfig(): Promise<CLIConfig>`
2. 在 `server/index.ts` 的 `getAllConfigs()` 中导入并添加到 `Promise.all`
3. 在 `web/src/pages/Dashboard.tsx` 的 `CLI_ICONS` 中添加图标映射

### 安全规则

- 绝不在 API 响应中返回完整的认证令牌或密码
- 读取配置文件失败时返回 `exists: false`，不要抛出异常
- MCP 服务器的环境变量中可能包含数据库密码等敏感信息，不要暴露

### 样式

- 暗色主题：背景 `bg-gray-950`，卡片 `bg-gray-900`
- 强调色：紫色系（`violet-400`/`violet-500`）
- 使用 Tailwind CSS class，不写自定义 CSS（`index.css` 中的 tailwind 指令除外）

## 常用命令

```bash
bun run dev      # 开发模式
bun run build    # 构建前端
bun run start    # 生产模式
```

## 依赖说明

- `smol-toml`: 解析 Codex 的 TOML 配置文件
- `concurrently`: 并行启动后端和 Vite 开发服务器
