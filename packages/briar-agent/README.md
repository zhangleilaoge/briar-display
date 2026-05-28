# @briar/agent

基于 [Pi](https://pi.dev) 的最简 Agent 封装。

## 安装

```bash
cd packages/briar-agent && bun link
```

## 使用

### CLI

```bash
# 直接提问
briar "当前目录有哪些文件？"

# 不传参数时会使用默认 prompt
briar
```

### SDK

```typescript
import { runAgent, createAgentSession } from '@briar/agent';

// 方式一：一行调用
await runAgent('当前目录有哪些文件？');

// 方式二：手动管理 session
const { session } = await createAgentSession();
try {
	session.subscribe((event) => {
		if (event.type === 'message_update' && event.assistantMessageEvent.type === 'text_delta') {
			process.stdout.write(event.assistantMessageEvent.delta);
		}
	});
	await session.prompt('当前目录有哪些文件？');
} finally {
	session.dispose();
}
```

## 项目结构

```
src/
├── index.ts   # SDK 入口，导出 runAgent / createAgentSession
└── cli.ts     # CLI 入口（bin: briar）
```

## 技术栈

- [@earendil-works/pi-coding-agent](https://www.npmjs.com/package/@earendil-works/pi-coding-agent) — Agent 核心 SDK
- [tsup](https://github.com/egoist/tsup) — TypeScript 打包

## License

Private
