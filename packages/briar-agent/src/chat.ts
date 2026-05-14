import type { KimiCode } from './client/index.js'
import type { Message } from './types.js'

export interface ChatOptions {
	kimi: KimiCode
	useCli: boolean
	streamMode: boolean
	messages: Message[]
	prompt: string
	abortSignal: AbortSignal
	onStreamUpdate: (content: string) => void
}

export async function sendChatMessage(options: ChatOptions): Promise<string> {
	const { kimi, useCli, streamMode, messages, prompt, abortSignal, onStreamUpdate } = options

	if (useCli) {
		if (streamMode) {
			let result = ''
			for await (const chunk of kimi.executeStream(prompt)) {
				if (abortSignal.aborted) break
				result += `${chunk}\n`
				onStreamUpdate(result)
			}
			return result
		}
		const result = await kimi.execute(prompt)
		return result
	}

	const apiMessages = [...messages, { role: 'user' as const, content: prompt }].map((m) => ({
		role: m.role,
		content: m.content,
	}))

	if (streamMode) {
		let result = ''
		for await (const chunk of kimi.chat.completions.createStream({
			model: 'claude-3-5-sonnet-20241022',
			messages: apiMessages,
		})) {
			if (abortSignal.aborted) break
			const content = chunk.choices[0]?.delta?.content
			if (content) {
				result += content
				onStreamUpdate(result)
			}
		}
		return result
	}

	const response = await kimi.chat.completions.create({
		model: 'claude-3-5-sonnet-20241022',
		messages: apiMessages,
	})
	return response.choices[0]?.message?.content || ''
}
