import type {
	AnthropicMessage,
	AnthropicMessageResponse,
	AnthropicMessageStreamPart,
} from 'claude-code-sdk/dist/types/index.js'
import type { AnthropicMessageCreateParams } from '../implementations/api.js'
import type { BaseClient } from './base.js'

function convertMessages(messages: AnthropicMessage[]): {
	system?: string
	messages: Array<{ role: 'user' | 'assistant'; content: string }>
} {
	let system: string | undefined
	const anthropicMessages: Array<{ role: 'user' | 'assistant'; content: string }> = []

	for (const m of messages) {
		if (m.role === 'system') {
			let content: string
			if (typeof m.content === 'string') {
				content = m.content
			} else {
				content = m.content.map((c) => c.text || '').join('')
			}
			system = content
		} else {
			let content: string
			if (typeof m.content === 'string') {
				content = m.content
			} else {
				content = m.content.map((c) => c.text || '').join('')
			}
			anthropicMessages.push({ role: m.role as 'user' | 'assistant', content })
		}
	}

	return { system, messages: anthropicMessages }
}

export class Messages {
	private client: BaseClient

	constructor(client: BaseClient) {
		this.client = client
	}

	async create(params: AnthropicMessageCreateParams): Promise<AnthropicMessageResponse> {
		if (params.stream) {
			// @ts-ignore streaming returns async iterable
			return this.createStream(params) as unknown as AnthropicMessageResponse
		}

		const { system, messages } = convertMessages(params.messages)
		return this.client.executeApi({
			model: params.model,
			messages,
			system,
			max_tokens: params.max_tokens,
			temperature: params.temperature,
			top_p: params.top_p,
			stop_sequences: params.stop_sequences,
			signal: params.signal,
		})
	}

	async *createStream(
		params: AnthropicMessageCreateParams,
	): AsyncIterable<AnthropicMessageStreamPart> {
		const { system, messages } = convertMessages(params.messages)
		const stream = this.client.executeApiStream({
			model: params.model,
			messages,
			system,
			max_tokens: params.max_tokens,
			temperature: params.temperature,
			top_p: params.top_p,
			stop_sequences: params.stop_sequences,
			signal: params.signal,
		})

		for await (const chunk of stream) {
			yield chunk as AnthropicMessageStreamPart
		}
	}
}
