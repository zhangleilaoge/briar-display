import type {
	AnthropicMessage,
	OpenAIChatCompletion,
	OpenAIMessage,
	SessionContinueParams,
	SessionParams,
} from 'claude-code-sdk/dist/types/index.js'
import type { BaseClient } from './base.js'

function convertMessages(messages: Array<OpenAIMessage | AnthropicMessage>): {
	system?: string
	messages: Array<{ role: 'user' | 'assistant'; content: string }>
} {
	let system: string | undefined
	const anthropicMessages: Array<{ role: 'user' | 'assistant'; content: string }> = []

	for (const m of messages) {
		if (m.role === 'system') {
			const content =
				typeof m.content === 'string'
					? m.content
					: Array.isArray(m.content)
						? m.content.map((c) => ('text' in c ? c.text : '')).join('')
						: String(m.content)
			system = content
		} else {
			const content =
				typeof m.content === 'string'
					? m.content
					: Array.isArray(m.content)
						? m.content.map((c) => ('text' in c ? c.text : '')).join('')
						: String(m.content)
			anthropicMessages.push({ role: m.role as 'user' | 'assistant', content })
		}
	}

	return { system, messages: anthropicMessages }
}

export class Sessions {
	private client: BaseClient

	constructor(client: BaseClient) {
		this.client = client
	}

	async create(params: SessionParams): Promise<Session> {
		const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
		return new Session(sessionId, this.client, params.messages)
	}

	async resume(sessionId: string): Promise<Session> {
		return new Session(sessionId, this.client, [])
	}
}

export class Session {
	readonly id: string
	private client: BaseClient
	private messages: Array<OpenAIMessage | AnthropicMessage>

	constructor(id: string, client: BaseClient, messages: Array<OpenAIMessage | AnthropicMessage>) {
		this.id = id
		this.client = client
		this.messages = [...messages]
	}

	async continue(params: SessionContinueParams): Promise<OpenAIChatCompletion> {
		this.messages = [...this.messages, ...params.messages]

		const { system, messages } = convertMessages(this.messages)
		const response = await this.client.executeApi({
			messages,
			system,
		})

		const content = response.content.map((c) => c.text).join('')
		const now = Math.floor(Date.now() / 1000)

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

	getMessages(): Array<OpenAIMessage | AnthropicMessage> {
		return [...this.messages]
	}
}
