import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'
import Anthropic from '@anthropic-ai/sdk'
import dotenv from 'dotenv'
import { skillManager } from './skills/index.js'
import { type ToolCall, toolRegistry } from './tools/index.js'

const findRepoRoot = (startDir: string) => {
	let currentDir = startDir
	while (true) {
		if (fs.existsSync(path.join(currentDir, 'pnpm-workspace.yaml'))) {
			return currentDir
		}
		const parentDir = path.dirname(currentDir)
		if (parentDir === currentDir) {
			return startDir
		}
		currentDir = parentDir
	}
}

const repoRoot = findRepoRoot(process.cwd())
dotenv.config({ path: path.join(repoRoot, '.env') })

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || process.env.KIMI_API_KEY || ''
const ANTHROPIC_BASE_URL = process.env.ANTHROPIC_BASE_URL || 'https://api.kimi.com/coding'
const MODEL = process.env.KIMI_MODEL || 'kimi-for-coding'
const MAX_TURNS = 10

const SYSTEM_PROMPT = `你是一个 helpful 的 AI Agent，运行在命令行环境中。
你可以帮助用户解答问题、编写代码、分析数据、操作文件等。
请用中文回复用户。

当你需要获取信息时，可以使用以下工具：
- read_file: 读取文件内容
- write_file: 写入文件
- list_dir: 列出目录内容
- glob: 按模式查找文件
- bash: 执行 shell 命令
- web_search: 网络搜索
- fetch_url: 获取网页内容

使用工具时，请直接调用，不要询问用户是否可以调用。`

type MessageContent =
	| { type: 'text'; text: string }
	| { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
	| { type: 'tool_result'; tool_use_id: string; content: string }

type ChatMessage =
	| { role: 'user'; content: string | MessageContent[] }
	| { role: 'assistant'; content: string | MessageContent[] }

export class CliAgent {
	private messages: ChatMessage[] = []
	private rl: readline.Interface | null = null
	private client: Anthropic
	private isRunning = false

	constructor() {
		this.client = new Anthropic({
			apiKey: ANTHROPIC_API_KEY,
			baseURL: ANTHROPIC_BASE_URL,
		})
	}

	private getReadline(): readline.Interface {
		if (!this.rl) {
			this.rl = readline.createInterface({
				input: process.stdin,
				output: process.stdout,
			})
		}
		return this.rl
	}

	async init() {
		await skillManager.init()
	}

	printBanner() {
		console.log(`\n${'='.repeat(50)}`)
		console.log('🤖  Kimi CLI Agent')
		console.log(`${'='.repeat(50)}`)
		console.log('模型:', MODEL)
		console.log('输入 /help 查看可用命令')
		console.log(`${'='.repeat(50)}\n`)
	}

	async processUserInput(userInput: string): Promise<boolean> {
		const trimmed = userInput.trim()
		if (!trimmed) return true

		if (trimmed.startsWith('/')) {
			return await this.handleCommand(trimmed)
		}

		await this.runAgentLoop(trimmed)
		return true
	}

	async runAgentLoop(userInput: string) {
		this.messages.push({ role: 'user', content: userInput })

		let turnCount = 0
		this.isRunning = true

		while (this.isRunning && turnCount < MAX_TURNS) {
			turnCount++
			const tools = toolRegistry.getDefinitions()

			try {
				const response = await this.client.messages.create({
					model: MODEL,
					max_tokens: 4096,
					system: SYSTEM_PROMPT,
					messages: this.messages as Anthropic.MessageParam[],
					tools: tools.length > 0 ? tools : undefined,
				})

				const content = response.content
				const textBlocks = content.filter((c) => c.type === 'text')
				const toolUseBlocks = content.filter((c) => c.type === 'tool_use')

				// 处理 tool_use
				if (toolUseBlocks.length > 0) {
					// 添加 assistant 的 tool_use 消息
					this.messages.push({
						role: 'assistant',
						content: content as MessageContent[],
					})

					// 执行每个 tool
					const toolResults: MessageContent[] = []

					for (const block of toolUseBlocks) {
						const toolName = block.name
						const toolArgs = block.input as Record<string, unknown>

						console.log(`\n🔧 调用工具: ${toolName}(${JSON.stringify(toolArgs)})`)

						const handler = toolRegistry.getHandler(toolName)
						let result: string
						if (handler) {
							try {
								result = await handler(toolArgs)
							} catch (error) {
								result = `❌ 工具执行失败: ${(error as Error).message}`
							}
						} else {
							result = `❌ 未知工具: ${toolName}`
						}

						const maxLength = 8000
						if (result.length > maxLength) {
							result = `${result.slice(0, maxLength)}\n... (已截断，共 ${result.length} 字符)`
						}

						toolResults.push({
							type: 'tool_result',
							tool_use_id: block.id,
							content: result,
						})

						const displayResult = result.length > 100 ? `${result.slice(0, 100)}...` : result
						console.log(`✅ 工具返回 (${result.length} 字符): ${displayResult}`)
					}

					// 添加 tool_result 消息
					this.messages.push({
						role: 'user',
						content: toolResults,
					})

					continue
				}

				// 普通文本回复
				const text = textBlocks.map((b) => b.text).join('')
				console.log(`\n🤖 ${text}\n`)
				this.messages.push({
					role: 'assistant',
					content: text,
				})
				break
			} catch (error) {
				console.error('❌ API 请求失败:', (error as Error).message)
				break
			}
		}

		if (turnCount >= MAX_TURNS) {
			console.log('\n⚠️ 达到最大轮次限制，停止执行\n')
		}
	}

	async handleCommand(command: string): Promise<boolean> {
		const parts = command.slice(1).split(' ')
		const cmd = parts[0].toLowerCase()
		const args = parts.slice(1)

		switch (cmd) {
			case 'quit':
			case 'exit':
				this.shutdown()
				return false

			case 'clear':
				this.clearHistory()
				return true

			case 'help':
				this.showHelp()
				return true

			case 'history':
				this.showHistory()
				return true

			case 'tools':
				this.listTools()
				return true

			case 'skill': {
				const subCmd = args[0]
				if (subCmd === 'list') {
					const skills = skillManager.listSkills()
					console.log(
						skills.length > 0 ? `已安装 skills: ${skills.join(', ')}` : '暂无已安装 skills',
					)
				} else if (subCmd === 'install' && args[1]) {
					const result = await skillManager.installSkill(args[1])
					console.log(result)
				} else if (subCmd === 'create' && args[1]) {
					const desc = args.slice(2).join(' ') || `${args[1]} skill`
					const result = await skillManager.createSkill(args[1], desc)
					console.log(result)
				} else {
					console.log('📖 Skill 命令:')
					console.log('  /skill list          - 列出已安装 skills')
					console.log('  /skill install <name> - 安装 skill（内置: git, npm）')
					console.log('  /skill create <name> [desc] - 创建新 skill 模板')
				}
				console.log()
				return true
			}

			default:
				console.log('❓ 未知命令，输入 /help 查看可用命令\n')
				return true
		}
	}

	shutdown() {
		console.log('\n👋 再见!')
		this.getReadline().close()
		this.isRunning = false
		setTimeout(() => process.exit(0), 100)
	}

	clearHistory() {
		this.messages = []
		console.log('✅ 对话历史已清空\n')
	}

	showHelp() {
		console.log('\n📖 可用命令:')
		console.log('  /help        - 显示帮助信息')
		console.log('  /clear       - 清空对话历史')
		console.log('  /quit        - 退出程序')
		console.log('  /history     - 显示当前对话轮数')
		console.log('  /tools       - 列出可用工具')
		console.log('  /skill list  - 列出已安装 skills')
		console.log('  /skill install <name> - 安装 skill')
		console.log('  /skill create <name>  - 创建 skill 模板')
		console.log('\n直接输入文字即可与 Agent 对话')
		console.log('Agent 会自动调用工具（读文件、执行命令、搜索等）\n')
	}

	showHistory() {
		const userMessages = this.messages.filter((m) => m.role === 'user')
		console.log(`📊 当前对话轮数: ${userMessages.length}\n`)
	}

	listTools() {
		const tools = toolRegistry.listTools()
		console.log('\n🔧 可用工具:')
		tools.forEach((t) => console.log(`  - ${t}`))
		console.log()
	}

	async run() {
		if (!ANTHROPIC_API_KEY) {
			console.error('❌ 未设置 API Key 环境变量')
			console.error('请在 .env 文件中添加 KIMI_API_KEY=sk-...')
			process.exit(1)
		}

		await this.init()
		this.printBanner()

		const isPiped = !process.stdin.isTTY

		if (isPiped) {
			const lines: string[] = []
			await new Promise<void>((resolve) => {
				this.getReadline().on('line', (line) => lines.push(line))
				this.getReadline().on('close', () => resolve())
			})
			for (const input of lines) {
				const shouldContinue = await this.processUserInput(input)
				if (!shouldContinue) break
			}
			if (!this.getReadline().closed) {
				this.shutdown()
			}
		} else {
			const askQuestion = () => {
				this.getReadline().question('👤 你: ', async (input) => {
					const shouldContinue = await this.processUserInput(input)
					if (shouldContinue && !this.getReadline().closed) {
						askQuestion()
					}
				})
			}
			askQuestion()
		}
	}
}
