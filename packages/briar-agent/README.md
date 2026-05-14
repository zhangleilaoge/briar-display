# @briar/agent

Briar Agent 是一个基于终端的 AI 助手客户端，同时提供 **TUI 交互界面** 和 **可编程 SDK** 两种使用方式。支持通过 Kimi HTTP API 或本地 `kimi` CLI 执行 AI 任务，内置多会话管理、子 Agent 并行执行和流式输出。

## 特性

- **双模式执行**：支持 Kimi API (`KIMI_API_KEY`) 或本地 `kimi` CLI (`--cli`)
- **终端 TUI**：基于 [Ink](https://github.com/vadimdemedes/ink) 的 React 交互界面，支持命令补全、键盘导航
- **多会话管理**：会话自动保存到 `~/.briar/sessions.json`，支持切换与归档
- **子 Agent 并行**：通过 `/sub` 派生独立子 Agent，并行执行多任务
- **流式输出**：实时显示 AI 生成内容，支持 `Ctrl+X` 中断
- **SDK 模式**：可在代码中作为库调用，兼容 OpenAI 风格的 chat completions API

## 安装

```bash
# 在 monorepo 内构建
bun run build

# 全局链接 CLI
bun link
```

## 配置

需要配置 `KIMI_API_KEY`。支持以下方式（按优先级）：

1. 环境变量：`KIMI_API_KEY=xxx`
2. 项目内 `.env` 文件：
   - `briar-assets/briar/.env`
   - `../briar-assets/briar/.env`
   - `../../briar-assets/briar/.env`

## CLI 使用

### 交互模式（TUI）

```bash
briar
# 或
briar --stream
```

启动 TUI 后，直接输入问题开始对话。支持以下命令：

| 命令 | 说明 |
|------|------|
| `/sub <prompt>` | 派生一个子 Agent 并行执行 |
| `/sub-list` | 列出所有子 Agent |
| `/sub-view <id>` | 查看子 Agent 完整输出 |
| `/subChat <id> <prompt>` | 继续子 Agent 的对话（resume session） |
| `/clear` | 清空当前会话（保留 session） |
| `/new` | 创建新会话 |
| `/session` | 切换会话 |
| `/session del <id>` | 删除会话 |
| `/help` | 显示帮助 |
| `/exit` | 退出 |

### 快捷键

| 按键 | 功能 |
|------|------|
| `↑ / ↓` | 聊天记录滚动 |
| `←`（输入为空时）| 填充上一条发出的消息（继续按浏览更早历史） |
| `→`（输入为空时）| 切换到子 Agent 面板 |
| `← / Esc` | 返回聊天面板 |
| `Ctrl+X` | 中断当前 AI 响应 |
| `Tab / Enter` | 命令补全确认 |

### 单次执行

```bash
# API 模式（默认）
briar "帮我写一个快速排序"

# CLI 模式（本地 kimi）
briar "帮我写一个快速排序" --cli

# 流式输出
briar "讲个故事" --stream
```

### 非 TTY 模式

当标准输入不是终端时，自动使用纯文本交互模式：

```bash
echo "hello" | briar
```

## SDK 使用

```typescript
import { KimiCode } from '@briar/agent'

const kimi = new KimiCode({ apiKey: 'your-api-key' })

// API 模式（聊天）
const response = await kimi.chat.completions.create({
	model: 'claude-3-5-sonnet-20241022',
	messages: [{ role: 'user', content: 'Hello' }],
})
console.log(response.choices[0].message.content)

// 流式 API
for await (const chunk of kimi.chat.completions.createStream({
	model: 'claude-3-5-sonnet-20241022',
	messages: [{ role: 'user', content: 'Hello' }],
})) {
	process.stdout.write(chunk.choices[0].delta.content || '')
}

// CLI 模式（本地 kimi 执行）
const result = await kimi.execute('帮我创建一个 React 组件')
console.log(result)

// CLI 流式
for await (const chunk of kimi.executeStream('帮我创建一个 React 组件')) {
	console.log(chunk)
}
```

## 项目结构

```
src/
├── index.ts              # SDK 入口，导出 KimiCode
├── main.tsx              # CLI 入口（bin: briar）
├── cli.tsx               # TUI 主组件（Ink）
├── modes.ts              # 纯文本交互模式 / 单次执行模式
├── agent.ts              # 子 Agent 命名与颜色
├── chat.ts               # 统一的消息发送逻辑
├── commands.ts           # 内置命令定义与帮助文本
├── command-router.ts     # 命令路由处理
├── session.ts            # 会话持久化（~/.briar/）
├── sub-agent.ts          # 子 Agent 创建与管理（spawn kimi）
├── types.ts              # 类型定义
├── client/
│   ├── index.ts          # KimiCode 客户端类
│   ├── base.ts           # BaseClient（API + CLI 双后端）
│   ├── chat.ts           # ChatCompletions（OpenAI 兼容适配）
│   ├── messages.ts       # Messages API
│   └── sessions.ts       # Sessions API
├── implementations/
│   ├── api.ts            # KimiApiExecutor（HTTP 调用）
│   └── cli.ts            # KimiCliExecutor（spawn kimi）
└── components/           # Ink UI 组件
    ├── ChatPanel.tsx
    ├── CompletionPopup.tsx
    ├── Header.tsx
    ├── InputBar.tsx
    ├── SessionPanel.tsx
    └── SubAgentPanel.tsx
```

## 技术栈

- [Ink](https://github.com/vadimdemedes/ink) — React for CLI 终端 UI
- [tsup](https://github.com/egoist/tsup) — TypeScript 打包
- [claude-code-sdk](https://www.npmjs.com/package/claude-code-sdk) — 底层 SDK 类型
- React 19

## License

Private
