const KIMI_BASE_URL = 'https://api.kimi.com/coding'
const DEFAULT_MODEL = 'claude-3-5-sonnet-20241022'

export interface KimiApiOptions {
	apiKey: string
	baseUrl?: string
	model?: string
	timeout?: number
}

export interface AnthropicMessage {
	role: 'user' | 'assistant'
	content: string
}

export interface AnthropicMessageCreateParams {
	model?: string
	messages: AnthropicMessage[]
	max_tokens?: number
	temperature?: number
	top_p?: number
	stream?: boolean
	stop_sequences?: string[]
	system?: string
	signal?: AbortSignal
}

export interface AnthropicMessageResponse {
	id: string
	type: 'message'
	role: 'assistant'
	model: string
	content: Array<{ type: 'text'; text: string }>
	stop_reason: string
	usage: {
		input_tokens: number
		output_tokens: number
	}
}

export interface AnthropicStreamChunk {
	type:
		| 'message_start'
		| 'content_block_start'
		| 'content_block_delta'
		| 'content_block_stop'
		| 'message_delta'
		| 'message_stop'
	message?: AnthropicMessageResponse
	index?: number
	content_block?: { type: 'text'; text: string }
	delta?:
		| { type: 'text_delta'; text: string }
		| { stop_reason: string; stop_sequence: string | null }
	usage?: { input_tokens: number; output_tokens: number }
}

export class KimiApiExecutor {
	private apiKey: string
	private baseUrl: string
	private model: string
	private timeout: number

	constructor(options: KimiApiOptions) {
		this.apiKey = options.apiKey
		this.baseUrl = options.baseUrl || KIMI_BASE_URL
		this.model = options.model || DEFAULT_MODEL
		this.timeout = options.timeout || 300000
	}

	async messagesCreate(params: AnthropicMessageCreateParams): Promise<AnthropicMessageResponse> {
		const controller = new AbortController()
		const timeoutId = setTimeout(() => controller.abort(), this.timeout)

		const signals = [controller.signal]
		if (params.signal) signals.push(params.signal)
		const signal = AbortSignal.any(signals)

		const systemMessage = params.system
		const body: Record<string, unknown> = {
			model: params.model || this.model,
			max_tokens: params.max_tokens || 4096,
			messages: params.messages,
			stream: false,
		}
		if (params.temperature !== undefined) body.temperature = params.temperature
		if (params.top_p !== undefined) body.top_p = params.top_p
		if (params.stop_sequences) body.stop_sequences = params.stop_sequences
		if (systemMessage) body.system = systemMessage

		try {
			const response = await fetch(`${this.baseUrl}/v1/messages`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-api-key': this.apiKey,
					'anthropic-version': '2023-06-01',
				},
				body: JSON.stringify(body),
				signal,
			})

			clearTimeout(timeoutId)

			if (!response.ok) {
				const errorText = await response.text()
				throw new Error(`Kimi API error: ${response.status} ${response.statusText}\n${errorText}`)
			}

			return (await response.json()) as AnthropicMessageResponse
		} catch (error) {
			clearTimeout(timeoutId)
			throw error
		}
	}

	async *messagesCreateStream(
		params: AnthropicMessageCreateParams,
	): AsyncGenerator<AnthropicStreamChunk> {
		const controller = new AbortController()
		const timeoutId = setTimeout(() => controller.abort(), this.timeout)

		const signals = [controller.signal]
		if (params.signal) signals.push(params.signal)
		const signal = AbortSignal.any(signals)

		const systemMessage = params.system
		const body: Record<string, unknown> = {
			model: params.model || this.model,
			max_tokens: params.max_tokens || 4096,
			messages: params.messages,
			stream: true,
		}
		if (params.temperature !== undefined) body.temperature = params.temperature
		if (params.top_p !== undefined) body.top_p = params.top_p
		if (params.stop_sequences) body.stop_sequences = params.stop_sequences
		if (systemMessage) body.system = systemMessage

		try {
			const response = await fetch(`${this.baseUrl}/v1/messages`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-api-key': this.apiKey,
					'anthropic-version': '2023-06-01',
				},
				body: JSON.stringify(body),
				signal,
			})

			if (!response.ok) {
				clearTimeout(timeoutId)
				const errorText = await response.text()
				throw new Error(`Kimi API error: ${response.status} ${response.statusText}\n${errorText}`)
			}

			if (!response.body) {
				clearTimeout(timeoutId)
				throw new Error('Kimi API stream: no response body')
			}

			const reader = response.body.getReader()
			const decoder = new TextDecoder()
			let buffer = ''

			try {
				while (true) {
					const { done, value } = await reader.read()
					if (done) break

					buffer += decoder.decode(value, { stream: true })
					const lines = buffer.split('\n')
					buffer = lines.pop() || ''

					let eventData = ''
					for (const line of lines) {
						const trimmed = line.trim()
						if (!trimmed) {
							if (eventData) {
								try {
									const chunk = JSON.parse(eventData) as AnthropicStreamChunk
									yield chunk
								} catch {
									// skip invalid json
								}
								eventData = ''
							}
							continue
						}
						if (trimmed.startsWith('data:')) {
							eventData = trimmed.slice(5).trim()
						}
					}
				}
			} finally {
				reader.releaseLock()
				clearTimeout(timeoutId)
			}
		} catch (error) {
			clearTimeout(timeoutId)
			throw error
		}
	}
}
