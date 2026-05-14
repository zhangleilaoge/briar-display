import { BaseClient, type KimiCodeOptions } from './base.js'
import { ChatCompletions } from './chat.js'
import { Messages } from './messages.js'
import { Sessions } from './sessions.js'

export class KimiCode extends BaseClient {
	readonly chat: { completions: ChatCompletions }
	readonly messages: Messages
	readonly sessions: Sessions

	constructor(options: KimiCodeOptions = {}) {
		super(options)

		const completionsInstance = new ChatCompletions(this)
		this.chat = {
			completions: completionsInstance,
		}

		this.messages = new Messages(this)
		this.sessions = new Sessions(this)
	}

	/**
	 * Execute a task via local kimi CLI (with -y auto-approve)
	 */
	async execute(prompt: string, options?: { workDir?: string }): Promise<string> {
		return this.executeCli(prompt, options)
	}

	/**
	 * Execute a task via local kimi CLI in streaming mode
	 */
	executeStream(prompt: string, options?: { workDir?: string }): AsyncGenerator<string> {
		return this.executeCliStream(prompt, options)
	}
}
