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

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

const MOCK_NEWS = [
	{
		title: '神舟二十号成功发射，航天员顺利进驻空间站',
		url: 'https://news.example.com/1',
		snippet: '北京时间今日上午，神舟二十号载人飞船在酒泉卫星发射中心成功发射...',
	},
	{
		title: '2026年五一假期全国旅游人次预计突破3亿',
		url: 'https://news.example.com/2',
		snippet: '文化和旅游部发布预测数据，今年五一假期国内旅游出游人次将达3.2亿...',
	},
	{
		title: '国产大飞机C919新增航线覆盖东南亚市场',
		url: 'https://news.example.com/3',
		snippet: '中国商飞宣布C919客机正式开通新加坡、曼谷等国际航线...',
	},
	{
		title: '全国铁路五一期间加开旅客列车5000余列',
		url: 'https://news.example.com/4',
		snippet: '国铁集团表示，五一假期将增开夜间高铁、旅游专列等满足出行需求...',
	},
	{
		title: '新一代人工智能芯片发布，算力提升300%',
		url: 'https://news.example.com/5',
		snippet: '国内半导体企业今日发布自研AI芯片，采用先进制程工艺...',
	},
]

const MOCK_WEATHER = `杭州今日天气（2026年5月1日）
- 天气状况：多云转晴
- 温度：15°C ~ 27°C
- 当前温度：22°C
- 风力：东风 2-3级
- 湿度：43%
- 空气质量：良（AQI 64）
- 紫外线：较强
- 降雨概率：10%

未来3天预报：
- 5月2日（周六）：多云，18°C ~ 27°C
- 5月3日（周日）：阵雨，14°C ~ 23°C
- 5月4日（周一）：多云，15°C ~ 26°C`

const MOCK_FORTUNE = `今日卦象：乾卦（天行健，君子以自强不息）

**卦象解析：**
乾卦为六十四卦之首，象征天、阳、刚健。今日得此卦，预示万事亨通，宜积极进取。

**事业**：今日事业运势旺盛，适合开展新计划、推进重要项目。上级认可，同事配合，顺风顺水。
**财运**：正财偏财皆有收获，但不宜冒险投机。稳健理财为上策。
**感情**：单身者今日桃花运佳，宜主动社交；有伴侣者感情升温，适合约会。
**健康**：精力充沛，适合运动锻炼。注意防晒补水。

**今日宜忌：**
- 宜：签约、出行、求职、投资、社交
- 忌：懒惰、拖延、争吵、冒险

**幸运色**：金色、白色
**幸运数字**：1、6
**吉时**：上午9-11时，下午3-5时`

async function searchHandler(args: Record<string, unknown>): Promise<string> {
	const query = (args.query as string).toLowerCase()
	const count = Math.min((args.count as number) || 5, 10)

	// ===== Mock 模式：天气查询 =====
	if (query.includes('天气') || query.includes('杭州') || query.includes('weather')) {
		await sleep(15000)
		return MOCK_WEATHER
	}

	// ===== Mock 模式：新闻查询 =====
	if (query.includes('新闻') || query.includes('news') || query.includes('热点')) {
		await sleep(15000)
		return MOCK_NEWS.slice(0, count)
			.map((r, i) => `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${r.snippet}\n`)
			.join('\n')
	}

	// ===== Mock 模式：卦象/运势查询 =====
	if (
		query.includes('卦') ||
		query.includes('运势') ||
		query.includes('占卜') ||
		query.includes('fortune')
	) {
		await sleep(15000)
		return MOCK_FORTUNE
	}

	return '未找到搜索结果'
}

async function fetchUrlHandler(args: Record<string, unknown>): Promise<string> {
	const url = args.url as string
	try {
		const response = await fetch(url, {
			headers: {
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
			},
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
