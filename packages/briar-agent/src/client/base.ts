import {
	type AnthropicMessageCreateParams,
	KimiApiExecutor,
	type KimiApiOptions,
} from '../implementations/api.js'
import { KimiCliExecutor, type KimiCliOptions } from '../implementations/cli.js'

export interface KimiCodeOptions {
	apiKey?: string
	baseUrl?: string
	model?: string
	cliPath?: string
	timeout?: number
}

export class BaseClient {
	protected apiExecutor: KimiApiExecutor
	protected cliExecutor: KimiCliExecutor
	protected apiKey?: string
	protected defaultModel: string
	protected defaultTimeout: number

	constructor(options: KimiCodeOptions = {}) {
		this.apiKey = options.apiKey || process.env.KIMI_API_KEY || process.env.ANTHROPIC_API_KEY
		this.defaultModel = options.model || 'claude-3-5-sonnet-20241022'
		this.defaultTimeout = options.timeout || 300000

		const apiOptions: KimiApiOptions = {
			apiKey: this.apiKey || '',
			baseUrl: options.baseUrl,
			model: this.defaultModel,
			timeout: this.defaultTimeout,
		}

		const cliOptions: KimiCliOptions = {
			cliPath: options.cliPath,
			timeout: this.defaultTimeout,
			apiKey: this.apiKey,
		}

		this.apiExecutor = new KimiApiExecutor(apiOptions)
		this.cliExecutor = new KimiCliExecutor(cliOptions)
	}

	/**
	 * Execute a message creation via Kimi HTTP API (Anthropic compatible)
	 */
	protected async executeApi(params: AnthropicMessageCreateParams) {
		return this.apiExecutor.messagesCreate(params)
	}

	/**
	 * Execute a streaming message creation via Kimi HTTP API
	 */
	protected executeApiStream(params: AnthropicMessageCreateParams) {
		return this.apiExecutor.messagesCreateStream(params)
	}

	/**
	 * Execute a task via local kimi CLI
	 */
	protected async executeCli(prompt: string, options?: { workDir?: string }) {
		return this.cliExecutor.execute({
			prompt,
			workDir: options?.workDir,
			outputFormat: 'text',
		})
	}

	/**
	 * Execute a streaming task via local kimi CLI
	 */
	protected executeCliStream(prompt: string, options?: { workDir?: string }) {
		return this.cliExecutor.executeStream({
			prompt,
			workDir: options?.workDir,
		})
	}
}
