import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { AuthStorage, ModelRegistry, createAgentSession } from '@earendil-works/pi-coding-agent'
import { config } from 'dotenv'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '../../.env') })

// 将 BRIAR_API_KEY 映射为 pi 需要的 KIMI_API_KEY
if (process.env.BRIAR_API_KEY && !process.env.KIMI_API_KEY) {
	process.env.KIMI_API_KEY = process.env.BRIAR_API_KEY
}

export { createAgentSession } from '@earendil-works/pi-coding-agent'
export type { CreateAgentSessionResult } from '@earendil-works/pi-coding-agent'

export async function runAgent(prompt: string) {
	const authStorage = AuthStorage.create()
	const modelRegistry = ModelRegistry.create(authStorage)
	const model = modelRegistry.find('kimi-coding', 'kimi-for-coding')
	if (!model) {
		throw new Error('Model kimi-for-coding not found')
	}
	const { session } = await createAgentSession({ model })
	try {
		session.subscribe((event) => {
			if (event.type === 'message_update' && event.assistantMessageEvent.type === 'text_delta') {
				process.stdout.write(event.assistantMessageEvent.delta)
			}
		})
		await session.prompt(prompt)
		console.log()
	} finally {
		session.dispose()
	}
}
