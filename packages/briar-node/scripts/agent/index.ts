import { CliAgent, registerDelegateTool } from './agent.js'
import { registerBashTools } from './tools/bash.js'
import { registerFilesystemTools } from './tools/filesystem.js'
import { registerSearchTools } from './tools/search.js'

// 注册内置工具
registerFilesystemTools()
registerBashTools()
registerSearchTools()
registerDelegateTool()

// 启动 Agent
const agent = new CliAgent()
agent.run().catch((error) => {
	console.error('❌ Agent 启动失败:', error)
	process.exit(1)
})
