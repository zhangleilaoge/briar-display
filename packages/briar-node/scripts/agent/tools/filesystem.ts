import path from 'path'
import fs from 'fs/promises'
import { type ToolDefinition, toolRegistry } from './index.js'

const WORKING_DIR = process.cwd()

function resolvePath(filePath: string): string {
	if (path.isAbsolute(filePath)) {
		return filePath
	}
	return path.resolve(WORKING_DIR, filePath)
}

const readFileTool: ToolDefinition = {
	name: 'read_file',
	description: '读取指定文件的内容。支持文本文件。如果文件不存在会报错。',
	input_schema: {
		type: 'object',
		properties: {
			path: {
				type: 'string',
				description: '文件路径，可以是相对路径或绝对路径',
			},
		},
		required: ['path'],
	},
}

const writeFileTool: ToolDefinition = {
	name: 'write_file',
	description: '写入内容到指定文件。如果文件不存在会创建，存在则覆盖。',
	input_schema: {
		type: 'object',
		properties: {
			path: {
				type: 'string',
				description: '文件路径，可以是相对路径或绝对路径',
			},
			content: {
				type: 'string',
				description: '要写入的文件内容',
			},
		},
		required: ['path', 'content'],
	},
}

const listDirTool: ToolDefinition = {
	name: 'list_dir',
	description: '列出指定目录下的文件和子目录。',
	input_schema: {
		type: 'object',
		properties: {
			path: {
				type: 'string',
				description: '目录路径，可以是相对路径或绝对路径。默认为当前目录',
			},
		},
		required: [],
	},
}

const globTool: ToolDefinition = {
	name: 'glob',
	description: '根据通配符模式查找文件。支持 * 和 ** 通配符。',
	input_schema: {
		type: 'object',
		properties: {
			pattern: {
				type: 'string',
				description: '通配符模式，例如 "*.ts" 或 "src/**/*.js"',
			},
		},
		required: ['pattern'],
	},
}

async function readFileHandler(args: Record<string, unknown>): Promise<string> {
	const filePath = resolvePath(args.path as string)
	try {
		const content = await fs.readFile(filePath, 'utf-8')
		return content
	} catch (error) {
		return `❌ 读取文件失败: ${(error as Error).message}`
	}
}

async function writeFileHandler(args: Record<string, unknown>): Promise<string> {
	const filePath = resolvePath(args.path as string)
	try {
		await fs.mkdir(path.dirname(filePath), { recursive: true })
		await fs.writeFile(filePath, args.content as string, 'utf-8')
		return `✅ 已写入文件: ${args.path}`
	} catch (error) {
		return `❌ 写入文件失败: ${(error as Error).message}`
	}
}

async function listDirHandler(args: Record<string, unknown>): Promise<string> {
	const dirPath = resolvePath((args.path as string) || '.')
	try {
		const entries = await fs.readdir(dirPath, { withFileTypes: true })
		const lines = entries.map((entry) => {
			const icon = entry.isDirectory() ? '📁' : '📄'
			return `${icon} ${entry.name}${entry.isDirectory() ? '/' : ''}`
		})
		return lines.join('\n') || '(空目录)'
	} catch (error) {
		return `❌ 读取目录失败: ${(error as Error).message}`
	}
}

async function globHandler(args: Record<string, unknown>): Promise<string> {
	const pattern = args.pattern as string
	const parts = pattern.split('/')

	async function recursiveGlob(currentDir: string, remainingParts: string[]): Promise<string[]> {
		if (remainingParts.length === 0) {
			return []
		}

		const part = remainingParts[0]
		const rest = remainingParts.slice(1)

		if (part === '**') {
			if (rest.length === 0) {
				const results: string[] = []
				async function collectAll(dir: string) {
					const entries = await fs.readdir(dir, { withFileTypes: true })
					for (const entry of entries) {
						const fullPath = path.join(dir, entry.name)
						if (entry.isDirectory()) {
							await collectAll(fullPath)
						} else {
							results.push(fullPath)
						}
					}
				}
				await collectAll(currentDir)
				return results
			}
			const results: string[] = []
			async function collectMatching(dir: string) {
				const matches = await recursiveGlob(dir, rest)
				results.push(...matches)
				const entries = await fs.readdir(dir, { withFileTypes: true })
				for (const entry of entries) {
					if (entry.isDirectory()) {
						await collectMatching(path.join(dir, entry.name))
					}
				}
			}
			await collectMatching(currentDir)
			return results
		}

		const entries = await fs.readdir(currentDir, { withFileTypes: true })
		const matches: string[] = []

		for (const entry of entries) {
			const fullPath = path.join(currentDir, entry.name)
			const isMatch =
				part === '*' || entry.name === part || entry.name.endsWith(part.replace('*', ''))

			if (isMatch) {
				if (rest.length === 0) {
					if (!entry.isDirectory()) {
						matches.push(fullPath)
					}
				} else if (entry.isDirectory()) {
					const subMatches = await recursiveGlob(fullPath, rest)
					matches.push(...subMatches)
				}
			}
		}

		return matches
	}

	try {
		const results = await recursiveGlob(WORKING_DIR, parts)
		return results.length > 0 ? results.join('\n') : '未找到匹配的文件'
	} catch (error) {
		return `❌ 搜索失败: ${(error as Error).message}`
	}
}

export function registerFilesystemTools() {
	toolRegistry.register(readFileTool, readFileHandler)
	toolRegistry.register(writeFileTool, writeFileHandler)
	toolRegistry.register(listDirTool, listDirHandler)
	toolRegistry.register(globTool, globHandler)
}
