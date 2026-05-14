import type {
	OpenAIChatCompletion,
	OpenAIChatCompletionChunk,
	OpenAIChatCompletionCreateParams,
	OpenAIMessage,
} from 'claude-code-sdk/dist/types/index.js'
import type { BaseClient } from './base.js'

function convertMessages(messages: OpenAIMessage[]): {
	system?: string
	messages: Array<{ role: 'user' | 'assistant'; content: string }>
} {
	let system: string | undefined
	const anthropicMessages: Array<{ role: 'user' | 'assistant'; content: string }> = []

	for (const m of messages) {
		if (m.role === 'system') {
			system = m.content
		} else {
			anthropicMessages.push({ role: m.role as 'user' | 'assistant', content: m.content })
		}
	}

	return { system, messages: anthropicMessages }
}

function buildCompletionResponse(response: {
	id: string
	model: string
	content: Array<{ type: 'text'; text: string }>
	usage: { input_tokens: number; output_tokens: number }
}): OpenAIChatCompletion {
	const now = Math.floor(Date.now() / 1000)
	const content = response.content.map((c) => c.text).join('')
	return {
		id: response.id,
		object: 'chat.completion',
		created: now,
		model: response.model,
		choices: [
			{
				index: 0,
				message: {
					role: 'assistant',
					content,
				},
				finish_reason: 'stop',
			},
		],
		usage: {
			prompt_tokens: response.usage.input_tokens,
			completion_tokens: response.usage.output_tokens,
			total_tokens: response.usage.input_tokens + response.usage.output_tokens,
		},
	}
}

function buildStreamChunk(
	content: string,
	model: string,
	isDone: boolean,
): OpenAIChatCompletionChunk {
	const now = Math.floor(Date.now() / 1000)
	return {
		id: `kimi-${now}-${Math.random().toString(36).substring(2, 9)}`,
		object: 'chat.completion.chunk',
		created: now,
		model,
		choices: [
			{
				index: 0,
				delta: isDone
					? {}
					: {
							role: 'assistant',
							content,
						},
				finish_reason: isDone ? 'stop' : null,
			},
		],
	}
}

export class ChatCompletions {
	private client: BaseClient

	constructor(client: BaseClient) {
		this.client = client
	}

	async create(
		params: OpenAIChatCompletionCreateParams & { signal?: AbortSignal },
	): Promise<OpenAIChatCompletion> {
		if (params.stream) {
			// @ts-ignore streaming returns async iterable
			return this.createStream(params) as unknown as OpenAIChatCompletion
		}

		const { system, messages } = convertMessages(params.messages)
		const response = await this.client.executeApi({
			model: params.model,
			messages,
			system,
			temperature: params.temperature,
			max_tokens: params.max_tokens,
			top_p: params.top_p,
			stop_sequences: params.stop
				? Array.isArray(params.stop)
					? params.stop
					: [params.stop]
				: undefined,
			signal: params.signal,
		})

		return buildCompletionResponse(response)
	}

	async *createStream(
		params: OpenAIChatCompletionCreateParams & { signal?: AbortSignal },
	): AsyncIterable<OpenAIChatCompletionChunk> {
		const { system, messages } = convertMessages(params.messages)
		const stream = this.client.executeApiStream({
			model: params.model,
			messages,
			system,
			temperature: params.temperature,
			max_tokens: params.max_tokens,
			top_p: params.top_p,
			stop_sequences: params.stop
				? Array.isArray(params.stop)
					? params.stop
					: [params.stop]
				: undefined,
			signal: params.signal,
		})

		let model = 'kimi-for-coding'
		for await (const chunk of stream) {
			if (chunk.type === 'message_start' && chunk.message) {
				model = chunk.message.model
				continue
			}
			if (chunk.type === 'content_block_delta' && chunk.delta && 'text' in chunk.delta) {
				yield buildStreamChunk(chunk.delta.text, model, false)
			}
			if (chunk.type === 'message_stop') {
				yield buildStreamChunk('', model, true)
			}
		}
	}
}
