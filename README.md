# AI CLI Config Manager

本地 Web 应用，一站式查看和管理本机所有 AI CLI 工具的配置状态。支持 MCP 服务器的启用/禁用、跨 CLI 复制、连通性检测、配置备份与还原。

## 快速开始

```bash
# 方式一：克隆仓库
git clone https://github.com/nilsir/aicli-config-manager.git
cd aicli-config-manager
bun install && bun install --cwd web
bun run dev

# 方式二：npx 一键启动（需先 build）
bunx aicli-config-manager
```

浏览器打开 http://localhost:3030

### 桌面应用安装（macOS）

从 [Releases](https://github.com/nilsir/aicli-config-manager/releases) 下载 `.dmg` 文件安装后，由于应用未经 Apple 签名，macOS 会提示"已损坏"或"无法验证开发者"。运行以下命令解除限制：

```bash
sudo xattr -rd com.apple.quarantine "/Applications/AI CLI Config Manager.app"
```

## 支持的 CLI 工具

| 工具 | 配置路径 | 读取内容 |
|------|----------|----------|
| Claude Code | `~/.claude/settings.json` | MCP 服务器、环境变量、插件、模型 |
| OpenCode | `~/.config/opencode/opencode.json` | 模型、代理、插件、Provider |
| Gemini CLI | `~/.gemini/settings.json` | MCP 服务器、OAuth 状态 |
| Codex CLI | `~/.codex/config.toml` + `auth.json` | 信任项目、OAuth 状态 |
| GitHub Copilot | `~/.config/github-copilot/apps.json` | 账户列表、认证状态 |

配置路径自动适配 macOS、Linux 和 Windows（使用 XDG 规范和 `%APPDATA%`）。

## 功能特性

- **仪表盘总览**：自动检测已安装的 AI CLI，显示认证状态、MCP 数量、模型信息
- **MCP 服务器管理**：启用/禁用、删除、跨 CLI 复制（Claude / Gemini）
- **MCP 重叠检测**：检测多个 CLI 中配置了相同 MCP 服务器的情况
- **MCP 连通性检测**：检查 stdio 命令是否存在、HTTP 端点是否可达
- **配置备份与还原**：编辑前自动备份，支持一键还原到任意历史版本
- **配置导入导出**：导出单个 CLI 或全量快照，换机迁移一键恢复
- **MCP 模板市场**：内置常用 MCP 配置模板（context7、filesystem、github 等），一键安装
- **配置健康检查**：Token 过期检测、MCP 命令路径验证、环境变量检查
- **多语言 UI**：支持中文 / English，自动跟随浏览器语言
- **配置 Diff**：对比两个 CLI 之间的 MCP 服务器差异
- **CLI 快捷启动**：一键在终端中启动 CLI 工具
- **桌面应用**：基于 Tauri 打包为原生桌面应用（macOS .app / .dmg）
- **VSCode 集成**：点击配置文件路径直接在 VSCode 中打开
- **跨平台**：支持 macOS、Linux、Windows
- **安全**：不会在 API 响应中暴露完整的认证令牌

## 命令

| 命令 | 说明 |
|------|------|
| `bun run dev` | 启动开发服务器（API + Vite HMR） |
| `bun run build` | 构建前端产物 |
| `bun run start` | 生产模式启动（需先 build） |
| `bun test` | 运行测试 |
| `bun run tauri:dev` | 启动 Tauri 桌面应用（开发模式） |
| `bun run tauri:build` | 构建桌面应用安装包 |

## API

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/health` | GET | 健康检查 |
| `/api/configs` | GET | 返回所有 CLI 配置 |
| `/api/configs/:id/mcp/:name/toggle` | POST | 启用/禁用 MCP 服务器 |
| `/api/configs/:id/mcp/:name/delete` | POST | 删除 MCP 服务器 |
| `/api/configs/:id/mcp` | POST | 添加 MCP 服务器 |
| `/api/configs/:id/model` | POST | 切换模型（Claude） |
| `/api/configs/:id/backups` | GET | 列出备份 |
| `/api/configs/:id/restore` | POST | 从备份还原 |
| `/api/mcp/check` | POST | MCP 连通性检测 |
| `/api/export` | GET | 导出全部配置快照 |
| `/api/export/:id` | GET | 导出单个 CLI 配置 |
| `/api/import` | POST | 从快照导入配置 |
| `/api/mcp/templates` | GET | 获取 MCP 模板列表 |
| `/api/mcp/templates/install` | POST | 安装 MCP 模板到指定 CLI |
| `/api/health-check` | POST | 配置健康检查 |
| `/api/diff` | GET | 对比两个 CLI 的 MCP 差异（?a=claude&b=gemini） |
| `/api/launch/:cliId` | POST | 在终端中启动指定 CLI |

## 技术栈

- **后端**: Bun HTTP Server
- **前端**: React 19 + Vite + TypeScript
- **样式**: Tailwind CSS（暗色主题）
- **TOML 解析**: smol-toml
- **桌面打包**: Tauri v2
- **CI**: GitHub Actions

## 项目结构

```
├── server/
│   ├── index.ts           # HTTP 服务器 + API 路由
│   ├── types.ts           # TypeScript 类型定义
│   ├── paths.ts           # 跨平台配置路径
│   └── readers/           # 各 CLI 配置读取器
├── web/
│   └── src/pages/
│       └── Dashboard.tsx  # 仪表盘主页面
├── tests/
│   └── api.test.ts        # API 集成测试
├── src-tauri/
│   ├── tauri.conf.json    # Tauri 桌面应用配置
│   └── src/               # Rust 入口（启动 Bun 后端 + WebView）
├── bin/
│   └── start.js           # npx 入口
└── .github/workflows/
    └── ci.yml             # CI 配置
```

## 贡献

见 [CONTRIBUTING.md](./CONTRIBUTING.md)。

## License

MIT
