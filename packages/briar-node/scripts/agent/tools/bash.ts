import { execSync } from 'child_process'
import { type ToolDefinition, toolRegistry } from './index.js'

const bashTool: ToolDefinition = {
	name: 'bash',
	description:
		'执行 bash 命令。用于运行 shell 命令、查看系统信息、操作 git 等。注意：只返回命令的输出，不会自动确认交互式提示。',
	input_schema: {
		type: 'object',
		properties: {
			command: {
				type: 'string',
				description: '要执行的 bash 命令',
			},
			timeout: {
				type: 'number',
				description: '命令超时时间（毫秒），默认 30000',
			},
		},
		required: ['command'],
	},
}

function bashHandler(args: Record<string, unknown>): string {
	const command = args.command as string
	const timeout = (args.timeout as number) || 30000

	try {
		const output = execSync(command, {
			timeout,
			encoding: 'utf-8',
			maxBuffer: 10 * 1024 * 1024,
		})
		return output || '(命令执行成功，无输出)'
	} catch (error) {
		const err = error as Error & { stdout?: string; stderr?: string }
		let result = `❌ 命令执行失败: ${err.message}`
		if (err.stdout) result += `\nstdout:\n${err.stdout}`
		if (err.stderr) result += `\nstderr:\n${err.stderr}`
		return result
	}
}

export function registerBashTools() {
	toolRegistry.register(bashTool, bashHandler)
}
