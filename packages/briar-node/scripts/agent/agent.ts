import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'
import Anthropic from '@anthropic-ai/sdk'
import boxen from 'boxen'
import chalk from 'chalk'
import dotenv from 'dotenv'
import { skillManager } from './skills/index.js'
import { type ToolCall, runWithAgentContext, toolRegistry } from './tools/index.js'

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
const MAX_TURNS = 40
const SUB_AGENT_MAX_TURNS = 40

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
- delegate_to_subagent: 将任务委派给子代理执行

## 子代理委派规则（重要）

当用户的请求包含**两个或以上可以独立执行的子任务**时，**你必须使用 delegate_to_subagent 工具并行委派**，而不是自己直接执行。

**必须使用子代理的场景：**
- "查询A和查询B" → 调用两个 delegate_to_subagent，一个负责查A，一个负责查B
- "分析这些文件" → 如果文件之间无依赖，每个文件一个 delegate_to_subagent
- "比较X和Y" → 一个子代理查X详情，一个子代理查Y详情

**为什么用子代理：**
- 多个子代理可以并行执行，总耗时远小于串行执行
- 每个子代理有独立的对话上下文，可以专注于自己的子任务
- 子代理不能创建新的子代理（最多一级委派）

**单个子任务时**（如只查一个东西），你可以直接调用工具，无需委派。

## 效率规则（重要）

- **拿到结果就停**：如果工具已经返回了你需要的信息，不要重复调用相同或类似的工具。直接总结并回复用户。
- **避免循环搜索**：不要为了"再确认一下"而反复搜索同一内容。信任已获取的结果。
- **每次最多调用一个工具**：在一次回复中，你只能调用一个工具。如果需要多个工具，请分多次调用。
- **控制工具调用次数**：尽量在 1-3 轮工具调用内完成任务并回复。

## 子代理结果使用规则（绝对重要）

- **子代理返回的结果已经足够完整和准确，你必须直接信任并使用**，绝对禁止再调用 web_search、fetch_url 或 bash 去验证、补充或重复获取相同信息。
- **如果所有子代理都已返回结果，立即基于这些结果汇总回复用户，不要再调用任何工具。**
- 子代理是专门处理子任务的专家，它的结果比你重新搜索更可靠。
- 违反此规则会浪费 API 调用并降低用户体验。

使用工具时，请直接调用，不要询问用户是否可以调用。`

const SUB_AGENT_SYSTEM_PROMPT = `你是一个子代理，负责执行主代理分配给你的具体任务。
你可以使用以下工具来完成任务：
- read_file: 读取文件内容
- write_file: 写入文件
- list_dir: 列出目录内容
- glob: 按模式查找文件
- bash: 执行 shell 命令
- web_search: 网络搜索
- fetch_url: 获取网页内容

**重要限制：你不能使用 delegate_to_subagent 工具，也不能创建其他子代理。**

**效率要求：**
- 子代理最多 40 轮对话，可以调用多个工具（比如先 web_search 搜索，再 fetch_url 抓取具体页面获取详细内容）。
- **搜索次数限制**：对同一个主题，最多调用 2 次 web_search。如果 2 次都没找到满意结果，直接说"未找到相关信息"，不要无限搜索。
- 拿到工具返回的结果后，**基于已有信息直接总结并返回给主代理**。不要继续调用相同或类似的工具去验证。
- 如果搜索工具返回了有效结果，立即整理输出，不要追问"还需要更多信息吗"。

**绝对禁止的行为：**
- 禁止输出"让我进一步搜索..."、"让我查询更多..."、"我将搜索..."等计划性文字。要么直接调用工具，要么直接总结回复，二选一。
- 如果你已经调用过工具并收到了结果，**必须基于这些结果直接写出完整回复**，不许再说还要搜什么。

**返回质量要求（极其重要）：**
- 你的返回结果会被主代理**直接呈现给用户**，主代理不会再补充搜索或验证。所以你必须一次性给足所有信息。
- 返回结果开头必须明确写"【查询完成】"，让主代理知道你已经完成，不需要再搜。
- **必须基于搜索结果回答**：web_search 返回的是 Bing 搜索结果（包含标题、链接和摘要），你要从中**提取关键信息**，整理成用户需要的格式。不要编造工具不可用的借口。
- **如实汇报**：如果搜索结果里确实没有相关信息，直接说"未找到相关信息"；如果搜索失败了，才说"搜索暂时不可用"。
- **绝对禁止编造数据**：不允许虚构天气、新闻、运势等具体内容。只能从搜索结果中提取和总结。
- 不要写"由于搜索结果有限"、"只获取到部分信息"等谦虚或保留的话。你获取到的就是完整结果，自信地呈现即可。

请独立完成任务并返回结果。请用中文回复。`

type MessageContent =
	| { type: 'text'; text: string }
	| { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
	| { type: 'tool_result'; tool_use_id: string; content: string }

type ChatMessage =
	| { role: 'user'; content: string | MessageContent[] }
	| { role: 'assistant'; content: string | MessageContent[] }

// ===== 子代理 =====
class SubAgent {
	private messages: ChatMessage[] = []
	private client: Anthropic
	private label: string
	private logs: string[] = []
	private taskPreview: string

	private startTimeStr: string
	private endTimeStr: string | null = null

	constructor(
		private task: string,
		label: string,
	) {
		this.client = new Anthropic({
			apiKey: ANTHROPIC_API_KEY,
			baseURL: ANTHROPIC_BASE_URL,
		})
		this.label = label
		this.taskPreview = task.length > 40 ? task.slice(0, 40) + '...' : task
		this.startTimeStr = new Date().toLocaleTimeString('zh-CN', { hour12: false })
		this.messages.push({ role: 'user', content: task })
	}

	private log(msg: string) {
		this.logs.push(msg)
	}

	flushLogs(elapsed: string, finished = true) {
		if (this.logs.length === 0) return
		this.endTimeStr = new Date().toLocaleTimeString('zh-CN', { hour12: false })
		const timeRange = finished
			? `${this.startTimeStr} ~ ${this.endTimeStr}`
			: `${this.startTimeStr} ~ 没完成`
		const boxContent = [
			chalk.bold(this.label) + ' ' + chalk.gray(this.taskPreview),
			...this.logs,
			chalk.gray(`── 耗时 ${elapsed}s | ${timeRange} ──`),
		].join('\n')
		console.log(
			boxen(boxContent, {
				padding: { left: 1, right: 1, top: 0, bottom: 0 },
				margin: { left: 2, top: 0, bottom: 0 },
				borderStyle: 'round',
				borderColor: 'gray',
				dimBorder: true,
			}),
		)
	}

	async run(): Promise<string> {
		const startTime = Date.now()
		const subAgentTools = toolRegistry
			.getDefinitions()
			.filter((t) => t.name !== 'delegate_to_subagent')
		let hasUsedTool = false

		for (let turnCount = 0; turnCount < SUB_AGENT_MAX_TURNS; turnCount++) {
			const availableTools = subAgentTools.length > 0 ? subAgentTools : undefined

			const response = await this.client.messages.create({
				model: MODEL,
				max_tokens: 4096,
				system: SUB_AGENT_SYSTEM_PROMPT,
				messages: this.messages as Anthropic.MessageParam[],
				tools: availableTools,
			})

			const content = response.content
			const textBlocks = content.filter((c) => c.type === 'text')
			const toolUseBlocks = content.filter((c) => c.type === 'tool_use')

			if (toolUseBlocks.length > 0) {
				hasUsedTool = true
				this.messages.push({
					role: 'assistant',
					content: content as MessageContent[],
				})
				// 工具并行
				const toolResults = await Promise.all(
					toolUseBlocks.map(async (block) => {
						const toolName = block.name
						const toolArgs = block.input as Record<string, unknown>
						this.log(`⏳ 调用 ${toolName}...`)
						const t0 = Date.now()

						const handler = toolRegistry.getHandler(toolName)
						let result: string
						if (handler) {
							try {
								result = await runWithAgentContext(this.label, () => handler(toolArgs))
							} catch (error) {
								result = `❌ 工具执行失败: ${(error as Error).message}`
							}
						} else {
							result = `❌ 未知工具: ${toolName}`
						}

						const toolElapsed = ((Date.now() - t0) / 1000).toFixed(1)
						this.log(`✅ ${toolName} 完成 (+${toolElapsed}s) → ${result.length} 字符`)

						const maxLength = 8000
						if (result.length > maxLength) {
							result = `${result.slice(0, maxLength)}\n... (已截断，共 ${result.length} 字符)`
						}

						return {
							type: 'tool_result' as const,
							tool_use_id: block.id,
							content: result,
						}
					}),
				)

				this.messages.push({
					role: 'user',
					content: toolResults,
				})
				continue
			}

			const text = textBlocks.map((b) => b.text).join('')

			if (!hasUsedTool) {
				this.messages.push({
					role: 'assistant',
					content: text,
				})
				this.messages.push({
					role: 'user',
					content:
						'你还没有调用工具获取实际信息。请使用 web_search 工具搜索相关信息，获取数据后再总结回复。不要只输出计划。',
				})
				continue
			}

			const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)
			this.logs.push(chalk.green('✓') + ' 完成')
			this.flushLogs(elapsed)
			return text
		}

		const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)
		this.logs.push(chalk.red('✗') + ' 达到最大轮次限制')
		this.flushLogs(elapsed, false)
		return '⚠️ 子代理达到最大轮次限制'
	}
}

// ===== 主代理 =====
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
		const totalStartTime = Date.now()
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

					// 并行执行所有工具
					const toolResults = await Promise.all(
						toolUseBlocks.map(async (block) => {
							const toolName = block.name
							const toolArgs = block.input as Record<string, unknown>

							// 简化工具调用日志
							if (toolName === 'delegate_to_subagent') {
								const task = (toolArgs.task as string) || ''
								const preview = task.length > 30 ? task.slice(0, 30) + '...' : task
								console.log(`\n🔧 delegate_to_subagent: ${preview}`)
							} else {
								console.log(`\n🔧 ${toolName}()`)
							}

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

							// delegate 工具的返回由子代理 box 展示，这里只打印其他工具的返回
							if (toolName !== 'delegate_to_subagent') {
								const displayResult = result.length > 80 ? `${result.slice(0, 80)}...` : result
								console.log(`  → ${result.length} 字符: ${displayResult}`)
							}

							return {
								type: 'tool_result' as const,
								tool_use_id: block.id,
								content: result,
							}
						}),
					)

					// 添加 tool_result 消息
					this.messages.push({
						role: 'user',
						content: toolResults,
					})

					continue
				}

				// 普通文本回复
				const text = textBlocks.map((b) => b.text).join('')
				const totalElapsed = ((Date.now() - totalStartTime) / 1000).toFixed(2)
				console.log(`\n🤖 ${text}`)
				console.log(`\n⏱️ 总消耗时间: ${totalElapsed}s\n`)
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
		console.log('Agent 会自动调用工具（读文件、执行命令、搜索等）')
		console.log('支持子代理并行执行多个独立任务\n')
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

// ===== 注册委派工具 =====
export function registerDelegateTool() {
	const delegateTool = {
		name: 'delegate_to_subagent',
		description:
			'将具体任务委派给子代理执行。当你需要并行执行多个独立的子任务时使用此工具。子代理拥有除委派之外的所有工具权限，不能创建新的子代理。',
		input_schema: {
			type: 'object' as const,
			properties: {
				task: {
					type: 'string',
					description: '要分配给子代理执行的具体任务描述。描述应尽量详细，包含必要的上下文信息。',
				},
			},
			required: ['task'],
		},
	}

	const SUB_AGENT_COLORS = [chalk.cyan, chalk.magenta, chalk.yellow, chalk.green, chalk.blue]
	let subAgentCounter = 0

	toolRegistry.register(delegateTool, async (args) => {
		const task = args.task as string
		const id = ++subAgentCounter
		const colorFn = SUB_AGENT_COLORS[(id - 1) % SUB_AGENT_COLORS.length]
		const label = colorFn(`[子代理${id}]`)
		const subAgent = new SubAgent(task, label)
		const result = await subAgent.run()
		return result
	})
}
