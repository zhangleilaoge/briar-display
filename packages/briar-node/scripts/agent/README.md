# 🤖 Kimi CLI Agent

基于 [Anthropic SDK](https://github.com/anthropics/anthropic-sdk-typescript) + [Kimi Code API](https://www.kimi.com/code) 实现的命令行 AI Agent，支持多轮对话、Tool Calling、联网搜索和可扩展的 Skill 系统。

## 特性

- **💬 多轮对话** — 支持上下文记忆的多轮交互
- **🔧 Tool Calling** — Agent 自动判断并调用工具，支持多轮工具调用链
- **📁 文件操作** — 读取、写入、列目录、Glob 文件搜索
- **🖥️ 命令执行** — 执行 Bash 命令并获取输出
- **🔍 联网搜索** — DuckDuckGo 搜索 + jina.ai 网页内容抓取
- **📦 Skill 系统** — 可插拔的 Skill 机制，支持内置安装和自定义创建
- **🚀 流式体验** — 工具调用过程实时可见，超过 100 字自动截断显示

## 架构

```
scripts/agent/
├── index.ts              # 入口：注册内置工具并启动 Agent
├── agent.ts              # 核心：对话循环、Tool Calling、命令处理
├── tools/
│   ├── index.ts          # Tool 注册中心（定义 + 处理器管理）
│   ├── filesystem.ts     # 文件工具：read_file / write_file / list_dir / glob
│   ├── bash.ts           # 系统工具：bash 命令执行
│   └── search.ts         # 搜索工具：web_search / fetch_url
└── skills/
    └── index.ts          # Skill 管理器：安装 / 创建 / 加载
```

### Agent 核心循环

```
用户输入
  → LLM 决策（回复 / 调用工具）
    → 如调用工具：执行 → 返回结果 → 再次请求 LLM
      → 循环直至 LLM 决定不再调用工具
    → 输出最终回复
```

单次对话最多支持 **10 轮** Tool Calling，防止无限循环。

## 快速开始

### 1. 配置环境变量

在项目根目录 `.env` 中配置：

```env
KIMI_API_KEY="sk-kimi-xxxxxxxx"
```

或显式指定 Anthropic 兼容配置：

```env
ANTHROPIC_API_KEY="sk-kimi-xxxxxxxx"
ANTHROPIC_BASE_URL="https://api.kimi.com/coding"
KIMI_MODEL="kimi-for-coding"
```

> 💡 支持任意 Anthropic 兼容 API，不仅限于 Kimi。

### 2. 启动 Agent

```bash
pnpm --filter @briar/node agent
```

或进入目录直接运行：

```bash
cd packages/briar-node
npx tsx scripts/agent/index.ts
```

## 使用示例

### 基础对话

```
👤 你: 你好，请简单自我介绍

🤖 你好！我是你的 AI 助手，一个运行在命令行环境中的智能代理...
```

### 文件操作（自动调用工具）

```
👤 你: 帮我查看当前目录有哪些文件

🔧 调用工具: list_dir({"path":"."})
✅ 工具返回 (174 字符): 📁 .agent-skills/
📄 .gitignore
📄 DATABASE.md
...

🤖 当前目录包含以下文件和文件夹：...
```

### 联网搜索

```
👤 你: 搜索一下 OpenAI 的最新动态

🔧 调用工具: web_search({"query":"OpenAI 最新动态","count":5})
✅ 工具返回 (2697 字符): 1. Official site
   URL: https://openai.com/
   OpenAI
...

🤖 根据搜索结果，以下是关于 OpenAI 的主要信息：...
```

### 执行命令

```
👤 你: 当前日期是多少

🔧 调用工具: bash({"command":"date"})
✅ 工具返回 (29 字符): Mon Apr 27 12:00:00 CST 2026

🤖 当前日期是 2026年4月27日，星期一。
```

## 内置命令

| 命令 | 说明 |
|------|------|
| `/help` | 显示帮助信息 |
| `/clear` | 清空对话历史 |
| `/history` | 查看当前对话轮数 |
| `/tools` | 列出可用工具 |
| `/skill list` | 列出已安装 Skills |
| `/skill install <name>` | 安装 Skill（内置: `git`, `npm`） |
| `/skill create <name> [desc]` | 创建新 Skill 模板 |
| `/quit` | 退出程序 |

## 内置工具

| 工具 | 功能 | 参数 |
|------|------|------|
| `read_file` | 读取文件内容 | `path`: 文件路径 |
| `write_file` | 写入/覆盖文件 | `path`: 文件路径, `content`: 内容 |
| `list_dir` | 列出目录内容 | `path`: 目录路径（默认当前目录） |
| `glob` | 按通配符查找文件 | `pattern`: 如 `"*.ts"` / `"src/**/*.js"` |
| `bash` | 执行 shell 命令 | `command`: 命令, `timeout`: 超时（默认 30s） |
| `web_search` | DuckDuckGo 搜索 | `query`: 关键词, `count`: 结果数（默认 5） |
| `fetch_url` | 抓取网页内容 | `url`: 网页地址 |

## Skill 系统

Skill 是可插拔的工具包，可以动态扩展 Agent 的能力。

### 安装内置 Skill

```
👤 你: /skill install git
✅ 已安装内置 skill: git
```

安装后新增工具：`git_status`, `git_log`

### 创建自定义 Skill

```
👤 你: /skill create docker "Docker 容器管理工具"
✅ 已创建 skill 模板: docker
目录: /path/to/project/.agent-skills/docker
请编辑 index.ts 实现具体逻辑
```

生成的 Skill 结构：

```
.agent-skills/docker/
├── skill.json    # Skill 元数据（名称、版本、描述、工具定义）
└── index.ts      # 实现文件
```

### Skill 开发示例

`skill.json`:

```json
{
  "name": "docker",
  "version": "1.0.0",
  "description": "Docker 容器管理工具",
  "tools": [
    {
      "name": "docker_ps",
      "description": "列出运行中的容器",
      "parameters": {
        "type": "object",
        "properties": {}
      },
      "required": []
    }
  ]
}
```

`index.ts`:

```typescript
export async function execute(args: Record<string, unknown>): Promise<string> {
  // TODO: 实现你的 skill 逻辑
  return `执行了 docker，参数: ${JSON.stringify(args)}`
}
```

> 当前版本 Skill 的 tools 通过 `skill.json` 声明后自动注册到 Tool 中心，handler 默认输出执行参数。后续可扩展为从 `index.ts` 导出自定义 handler。

## 扩展开发

### 添加新 Tool

在任意文件中：

```typescript
import { toolRegistry } from './tools/index.js'

toolRegistry.register(
  {
    name: 'my_tool',
    description: '我的自定义工具',
    input_schema: {
      type: 'object',
      properties: {
        param: { type: 'string', description: '参数说明' },
      },
      required: ['param'],
    },
  },
  async (args) => {
    return `执行结果: ${args.param}`
  }
)
```

然后在 `index.ts` 中引入该文件即可自动注册。

## 技术栈

- **Runtime**: Node.js 22+ / tsx
- **SDK**: `@anthropic-ai/sdk`
- **API**: Kimi Code API (Anthropic 兼容)
- **搜索**: DuckDuckGo HTML + jina.ai Reader
- **项目**: briar-node (pnpm workspace)

## 环境变量

| 变量 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `KIMI_API_KEY` | ✅ | - | API Key（兼容 Anthropic 格式） |
| `ANTHROPIC_API_KEY` | ❌ | `KIMI_API_KEY` | 显式指定 Anthropic Key |
| `ANTHROPIC_BASE_URL` | ❌ | `https://api.kimi.com/coding` | API Base URL |
| `KIMI_MODEL` | ❌ | `kimi-for-coding` | 模型名称 |

## License

Private
