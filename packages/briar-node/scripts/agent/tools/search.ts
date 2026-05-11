import { type ToolDefinition, toolRegistry } from './index.js'

const searchTool: ToolDefinition = {
	name: 'web_search',
	description: '进行网络搜索，获取与查询相关的网页结果。返回 Bing 搜索结果的标题、链接和摘要。你需要从中提取关键信息来回答用户，而不是编造信息。',
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

interface SearchResult {
	title: string
	url: string
	snippet: string
}

async function bingSearch(query: string, count: number): Promise<SearchResult[]> {
	try {
		const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&setmkt=zh-CN&setlang=zh-Hans`
		const response = await fetch(searchUrl, {
			headers: {
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
				'Accept-Language': 'zh-CN,zh;q=0.9',
			},
			signal: AbortSignal.timeout(15000),
		})

		if (!response.ok) {
			return []
		}

		const html = await response.text()
		const results: SearchResult[] = []

		// 按 b_algo 块分割
		const blocks = html.split(/<li class="b_algo"/).slice(1)

		for (const block of blocks) {
			if (results.length >= count) break

			// 提取标题和链接
			const titleMatch = block.match(/<h2[^>]*>.*?<a[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>.*?<\/h2>/s)
			// 提取摘要
			const snippetMatch = block.match(/<p[^>]*>(.*?)<\/p>/s)

			if (titleMatch) {
				const url = titleMatch[1].replace(/&amp;/g, '&')
				const title = titleMatch[2].replace(/<[^>]+>/g, '').trim()
				const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, '').trim() : ''

				if (title) {
					results.push({ title, url, snippet })
				}
			}
		}

		return results
	} catch (error) {
		console.error('搜索失败:', error)
		return []
	}
}

async function searchHandler(args: Record<string, unknown>): Promise<string> {
	const query = args.query as string
	const count = Math.min((args.count as number) || 5, 10)

	const results = await bingSearch(query, count)

	if (results.length === 0) {
		return '未找到搜索结果'
	}

	return results
		.map((r, i) => `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${r.snippet}\n`)
		.join('\n')
}

async function fetchUrlHandler(args: Record<string, unknown>): Promise<string> {
	const url = args.url as string
	try {
		const response = await fetch(url, {
			headers: {
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
			},
			signal: AbortSignal.timeout(15000),
		})
		if (!response.ok) {
			return `❌ 获取网页失败: HTTP ${response.status}`
		}
		const html = await response.text()
		const text = html
			.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
			.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
			.replace(/<[^>]+>/g, ' ')
			.replace(/\s+/g, ' ')
			.trim()
		return text.slice(0, 10000) || '(页面内容为空)'
	} catch (error) {
		return `❌ 获取网页失败: ${(error as Error).message}`
	}
}

export function registerSearchTools() {
	toolRegistry.register(searchTool, searchHandler)
	toolRegistry.register(fetchUrlTool, fetchUrlHandler)
}
