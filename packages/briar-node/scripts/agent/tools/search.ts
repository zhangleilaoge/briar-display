import { type ToolDefinition, toolRegistry } from './index.js'

const searchTool: ToolDefinition = {
	name: 'web_search',
	description: '进行网络搜索，获取与查询相关的网页结果。返回搜索结果的标题、链接和摘要。',
	input_schema: {
		type: 'object',
		properties: {
			query: {
				type: 'string',
				description: '搜索关键词',
			},
			count: {
				type: 'number',
				description: '返回结果数量，默认 5，最大 10',
			},
		},
		required: ['query'],
	},
}

const fetchUrlTool: ToolDefinition = {
	name: 'fetch_url',
	description:
		'获取指定 URL 的网页内容。用于读取网页的完整内容，支持通过 jina.ai 读取器获取清洗后的文本。',
	input_schema: {
		type: 'object',
		properties: {
			url: {
				type: 'string',
				description: '要获取的网页 URL',
			},
		},
		required: ['url'],
	},
}

async function searchHandler(args: Record<string, unknown>): Promise<string> {
	const query = args.query as string
	const count = Math.min((args.count as number) || 5, 10)

	try {
		const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
		const response = await fetch(searchUrl, {
			headers: {
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
			},
		})

		if (!response.ok) {
			return `❌ 搜索失败: HTTP ${response.status}`
		}

		const html = await response.text()
		const results: Array<{ title: string; url: string; snippet: string }> = []
		const resultBlocks = html.split(/<div class="result\b[^"]*"/)

		for (let i = 1; i < resultBlocks.length && results.length < count; i++) {
			const block = resultBlocks[i]
			const titleMatch = block.match(/<a[^>]+class="result__a"[^>]*>(.*?)<\/a>/)
			const urlMatch = block.match(/<a[^>]+href="(.*?)"/)
			const snippetMatch = block.match(/<a[^>]+class="result__snippet"[^>]*>(.*?)<\/a>/)

			if (titleMatch && urlMatch) {
				const title = titleMatch[1].replace(/<[^>]+>/g, '').trim()
				let url = urlMatch[1]
				const duckUrlMatch = url.match(/uddg=([^&]+)/)
				if (duckUrlMatch) {
					url = decodeURIComponent(duckUrlMatch[1])
				}
				const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, '').trim() : ''

				results.push({ title, url, snippet })
			}
		}

		if (results.length === 0) {
			return '未找到搜索结果'
		}

		return results
			.map((r, i) => `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${r.snippet}\n`)
			.join('\n')
	} catch (error) {
		return `❌ 搜索失败: ${(error as Error).message}`
	}
}

async function fetchUrlHandler(args: Record<string, unknown>): Promise<string> {
	const url = args.url as string

	try {
		const jinaUrl = `https://r.jina.ai/http://${url.replace(/^https?:\/\//, '')}`
		const response = await fetch(jinaUrl, {
			headers: {
				'User-Agent': 'Mozilla/5.0 (compatible; AgentBot/1.0)',
			},
		})

		if (!response.ok) {
			const directResponse = await fetch(url, {
				headers: {
					'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
				},
			})
			if (!directResponse.ok) {
				return `❌ 获取网页失败: HTTP ${directResponse.status}`
			}
			const html = await directResponse.text()
			const text = html
				.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
				.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
				.replace(/<[^>]+>/g, ' ')
				.replace(/\s+/g, ' ')
				.trim()
			return text.slice(0, 10000) || '(页面内容为空)'
		}

		const text = await response.text()
		return text.slice(0, 10000) || '(页面内容为空)'
	} catch (error) {
		return `❌ 获取网页失败: ${(error as Error).message}`
	}
}

export function registerSearchTools() {
	toolRegistry.register(searchTool, searchHandler)
	toolRegistry.register(fetchUrlTool, fetchUrlHandler)
}
