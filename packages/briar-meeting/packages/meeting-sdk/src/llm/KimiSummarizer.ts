import type { Summarizer, SummarizerOptions, SummaryChunk, TranscriptSegment } from '../types.js'

export class KimiSummarizer implements Summarizer {
	private apiKey: string
	private baseURL: string
	private model: string
	private language: string

	constructor(options: SummarizerOptions) {
		this.apiKey = options.apiKey
		this.baseURL = options.baseURL ?? 'https://api.moonshot.cn/v1'
		this.model = options.model ?? 'moonshot-v1-8k'
		this.language = options.language ?? 'zh-CN'
	}

	async summarize(segments: TranscriptSegment[], context?: string): Promise<SummaryChunk> {
		const startTime = segments[0]?.startTime ?? 0
		const endTime = segments[segments.length - 1]?.endTime ?? startTime
		const dialogue = segments.map((s) => `[${s.speakerId || '未知'}] ${s.text}`).join('\n')

		const systemPrompt = this.buildSystemPrompt(context)
		const userPrompt = `请总结以下会议片段：\n\n${dialogue}`

		const response = await fetch(`${this.baseURL}/chat/completions`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${this.apiKey}`,
			},
			body: JSON.stringify({
				model: this.model,
				messages: [
					{ role: 'system', content: systemPrompt },
					{ role: 'user', content: userPrompt },
				],
				temperature: 0.3,
				response_format: { type: 'json_object' },
			}),
		})

		if (!response.ok) {
			const text = await response.text()
			throw new Error(`Kimi API 错误 (${response.status}): ${text}`)
		}

		const data = (await response.json()) as {
			choices?: Array<{ message?: { content?: string } }>
		}

		const content = data.choices?.[0]?.message?.content
		if (!content) {
			throw new Error('Kimi API 返回空内容')
		}

		let parsed: { topics?: string[]; summary?: string }
		try {
			parsed = JSON.parse(content)
		} catch {
			parsed = { topics: [], summary: content }
		}

		return {
			id: crypto.randomUUID(),
			startTime,
			endTime,
			topics: parsed.topics ?? [],
			content: parsed.summary ?? '',
			rawSegmentIds: segments.map((s) => s.id),
		}
	}

	private buildSystemPrompt(context?: string): string {
		const base = `你是一个专业的会议助理。请将给出的会议对话片段整理成结构化的总结。
请用 ${this.language} 输出，并严格返回 JSON 格式：
{
  "topics": ["主题1", "主题2"],
  "summary": "markdown 格式的总结内容，保留关键决策、待办事项和发言人观点"
}
要求：
- 分条列出要点
- 标注每个要点的发言人（如果有）
- 如果有明确的行动项，请单独列出`

		if (!context) return base
		return `${base}\n\n以下是补充背景信息（来自上传的 PDF），总结时请结合这些上下文：\n${context.slice(0, 4000)}`
	}
}
