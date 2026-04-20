# 贡献指南

感谢你对 AI CLI Config Manager 的关注！欢迎提交 Issue 和 Pull Request。

## 开发环境

- [Bun](https://bun.sh/) >= 1.0
- Node.js >= 18（可选，用于 npx 启动）

```bash
git clone https://github.com/nilsir/aicli-config-manager.git
cd aicli-config-manager
bun install
bun install --cwd web
bun run dev
```

## 添加新的 CLI 支持

1. 在 `server/readers/` 下新建文件，例如 `cursor.ts`
2. 导出 `async function readCursorConfig(): Promise<CLIConfig>`
3. 在 `server/paths.ts` 中添加跨平台路径
4. 在 `server/index.ts` 的 `getAllConfigs()` 中导入并添加
5. 在 `web/src/pages/Dashboard.tsx` 的 `CLI_ICONS` 中添加图标
6. 如果该 CLI 支持 MCP 编辑，在 `server/index.ts` 的 `configPathById()` 和前端的 `EDITABLE_CLIS` 中注册

## 代码规范

- TypeScript 严格模式
- 使用 Tailwind CSS，不写自定义 CSS
- 暗色主题：背景 `bg-gray-950`，卡片 `bg-gray-900`，强调色紫色系
- 读取配置失败时返回 `exists: false`，不抛异常
- 绝不在 API 响应中暴露完整的认证令牌

## 测试

```bash
bun test
```

测试文件放在 `tests/` 目录下。

## 提交规范

- `feat:` 新功能
- `fix:` 修复
- `docs:` 文档
- `refactor:` 重构
- `test:` 测试
