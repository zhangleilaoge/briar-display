import path from 'path'
import fs from 'fs/promises'
import { type ToolDefinition, type ToolHandler, toolRegistry } from '../tools/index.js'

export interface SkillManifest {
	name: string
	version: string
	description: string
	author?: string
	tools?: Array<{
		name: string
		description: string
		parameters: Record<string, unknown>
		required?: string[]
	}>
}

export interface Skill {
	name: string
	manifest: SkillManifest
	tools: Array<{ definition: ToolDefinition; handler: ToolHandler }>
}

const SKILLS_DIR = path.resolve(process.cwd(), '.agent-skills')

class SkillManager {
	private skills: Map<string, Skill> = new Map()

	async init() {
		await fs.mkdir(SKILLS_DIR, { recursive: true })
		await this.loadInstalledSkills()
	}

	async loadInstalledSkills() {
		try {
			const entries = await fs.readdir(SKILLS_DIR)
			for (const entry of entries) {
				const skillPath = path.join(SKILLS_DIR, entry)
				const stat = await fs.stat(skillPath)
				if (stat.isDirectory()) {
					await this.loadSkillFromDir(skillPath)
				}
			}
		} catch {
			// 目录不存在或为空
		}
	}

	async loadSkillFromDir(dir: string) {
		try {
			const manifestPath = path.join(dir, 'skill.json')
			const manifestContent = await fs.readFile(manifestPath, 'utf-8')
			const manifest = JSON.parse(manifestContent) as SkillManifest

			// 尝试加载 index.ts/js
			const indexPath = path.join(dir, 'index.ts')
			try {
				await fs.access(indexPath)
				// TS 文件需要动态 import，这里先简单处理
				// 实际 tools 通过 skill.json 定义，handler 用默认实现
			} catch {
				// 没有 index.ts
			}

			// 从 manifest 注册 tools
			const tools: Skill['tools'] = []
			if (manifest.tools) {
				for (const toolDef of manifest.tools) {
					const definition: ToolDefinition = {
						name: toolDef.name,
						description: toolDef.description,
						input_schema: toolDef.parameters as ToolDefinition['input_schema'],
					}
					const handler = this.createDefaultHandler(toolDef.name)
					tools.push({ definition, handler })
					toolRegistry.register(definition, handler)
				}
			}

			const skill: Skill = { name: manifest.name, manifest, tools }
			this.skills.set(manifest.name, skill)
		} catch (error) {
			console.error(`加载 skill 失败 (${dir}):`, (error as Error).message)
		}
	}

	private createDefaultHandler(toolName: string): ToolHandler {
		return async (args: Record<string, unknown>) => {
			return `[${toolName}] 执行结果: ${JSON.stringify(args)}`
		}
	}

	async installSkill(source: string) {
		// 支持从本地路径、git url 或内置模板安装
		if (source.startsWith('http') || source.startsWith('git@')) {
			return `❌ 暂不支持从远程安装 skill: ${source}\n请手动克隆到 ${SKILLS_DIR}/<skill-name>/`
		}

		// 内置 skill
		const builtInSkills: Record<string, () => Promise<string>> = {
			git: () => this.createGitSkill(),
			npm: () => this.createNpmSkill(),
		}

		if (builtInSkills[source]) {
			return await builtInSkills[source]()
		}

		// 本地路径
		const localPath = path.resolve(source)
		try {
			const stat = await fs.stat(localPath)
			if (!stat.isDirectory()) {
				return `❌ 不是有效的 skill 目录: ${source}`
			}
			const destPath = path.join(SKILLS_DIR, path.basename(localPath))
			await fs.cp(localPath, destPath, { recursive: true })
			await this.loadSkillFromDir(destPath)
			return `✅ 已安装 skill: ${path.basename(localPath)}`
		} catch (error) {
			return `❌ 安装失败: ${(error as Error).message}`
		}
	}

	async createSkill(name: string, description: string) {
		const skillDir = path.join(SKILLS_DIR, name)
		try {
			await fs.mkdir(skillDir, { recursive: true })

			const manifest: SkillManifest = {
				name,
				version: '1.0.0',
				description,
			}

			await fs.writeFile(path.join(skillDir, 'skill.json'), JSON.stringify(manifest, null, 2))

			const indexTs = `// Skill: ${name}
// ${description}

export async function execute(args: Record<string, unknown>): Promise<string> {
  // TODO: 实现你的 skill 逻辑
  return \`执行了 ${name}，参数: \${JSON.stringify(args)}\`
}
`
			await fs.writeFile(path.join(skillDir, 'index.ts'), indexTs)

			return `✅ 已创建 skill 模板: ${name}\n目录: ${skillDir}\n请编辑 index.ts 实现具体逻辑`
		} catch (error) {
			return `❌ 创建失败: ${(error as Error).message}`
		}
	}

	async createGitSkill(): Promise<string> {
		const name = 'git'
		const skillDir = path.join(SKILLS_DIR, name)
		await fs.mkdir(skillDir, { recursive: true })

		const manifest: SkillManifest = {
			name,
			version: '1.0.0',
			description: 'Git 操作工具集',
			tools: [
				{
					name: 'git_status',
					description: '查看 git 仓库状态',
					parameters: {
						type: 'object',
						properties: {
							path: { type: 'string', description: '仓库路径，默认为当前目录' },
						},
					},
					required: [],
				},
				{
					name: 'git_log',
					description: '查看 git 提交历史',
					parameters: {
						type: 'object',
						properties: {
							path: { type: 'string', description: '仓库路径' },
							count: { type: 'number', description: '显示条数，默认 10' },
						},
					},
					required: [],
				},
			],
		}

		await fs.writeFile(path.join(skillDir, 'skill.json'), JSON.stringify(manifest, null, 2))

		// 注册 git tools
		const { execSync } = await import('child_process')

		toolRegistry.register(
			{
				name: 'git_status',
				description: '查看 git 仓库状态',
				input_schema: {
					type: 'object',
					properties: {
						path: { type: 'string', description: '仓库路径，默认为当前目录' },
					},
					required: [],
				},
			},
			(args: Record<string, unknown>) => {
				try {
					const cwd = (args.path as string) || process.cwd()
					return execSync('git status', { cwd, encoding: 'utf-8' })
				} catch (error) {
					return `❌ ${(error as Error).message}`
				}
			},
		)

		toolRegistry.register(
			{
				name: 'git_log',
				description: '查看 git 提交历史',
				input_schema: {
					type: 'object',
					properties: {
						path: { type: 'string', description: '仓库路径' },
						count: { type: 'number', description: '显示条数，默认 10' },
					},
					required: [],
				},
			},
			(args: Record<string, unknown>) => {
				try {
					const cwd = (args.path as string) || process.cwd()
					const count = (args.count as number) || 10
					return execSync(`git log --oneline -n ${count}`, { cwd, encoding: 'utf-8' })
				} catch (error) {
					return `❌ ${(error as Error).message}`
				}
			},
		)

		const skill: Skill = { name, manifest, tools: [] }
		this.skills.set(name, skill)
		return '✅ 已安装内置 skill: git'
	}

	async createNpmSkill(): Promise<string> {
		const name = 'npm'
		const skillDir = path.join(SKILLS_DIR, name)
		await fs.mkdir(skillDir, { recursive: true })

		const manifest: SkillManifest = {
			name,
			version: '1.0.0',
			description: 'NPM 包管理工具集',
			tools: [
				{
					name: 'npm_list',
					description: '列出已安装的 npm 包',
					parameters: {
						type: 'object',
						properties: {
							path: { type: 'string', description: '项目路径' },
							depth: { type: 'number', description: '依赖深度，默认 0' },
						},
					},
					required: [],
				},
			],
		}

		await fs.writeFile(path.join(skillDir, 'skill.json'), JSON.stringify(manifest, null, 2))

		const { execSync } = await import('child_process')

		toolRegistry.register(
			{
				name: 'npm_list',
				description: '列出已安装的 npm 包',
				input_schema: {
					type: 'object',
					properties: {
						path: { type: 'string', description: '项目路径' },
						depth: { type: 'number', description: '依赖深度，默认 0' },
					},
					required: [],
				},
			},
			(args: Record<string, unknown>) => {
				try {
					const cwd = (args.path as string) || process.cwd()
					const depth = (args.depth as number) ?? 0
					return execSync(`npm list --depth=${depth}`, { cwd, encoding: 'utf-8' })
				} catch (error) {
					return `❌ ${(error as Error).message}`
				}
			},
		)

		const skill: Skill = { name, manifest, tools: [] }
		this.skills.set(name, skill)
		return '✅ 已安装内置 skill: npm'
	}

	listSkills(): string[] {
		return Array.from(this.skills.keys())
	}

	getSkill(name: string): Skill | undefined {
		return this.skills.get(name)
	}
}

export const skillManager = new SkillManager()
