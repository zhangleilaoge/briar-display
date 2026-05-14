import { createInterface } from 'readline'
import { KimiCode } from './client/index.js'

/* =================================================================
 *  其他运行模式
 * ================================================================= */

export async function runPlainInteractive(kimi: KimiCode, useCli: boolean, streamMode: boolean) {
	const msgs: Array<{ role: 'user' | 'assistant'; content: string }> = []
	console.log('Briar Agent -- type your message, /exit to quit\n')
	const rl = createInterface({ input: process.stdin, output: process.stdout, prompt: '> ' })

	for await (const line of rl) {
		const input = line.trim()
		if (!input) {
			rl.prompt()
			continue
		}
		if (input === '/exit' || input === '/quit') break

		try {
			if (useCli) {
				const result = await kimi.execute(input)
				console.log(`\n${result}\n`)
			} else {
				msgs.push({ role: 'user', content: input })
				const response = await kimi.chat.completions.create({
					model: 'claude-3-5-sonnet-20241022',
					messages: msgs.map((m) => ({ role: m.role, content: m.content })),
				})
				const content = response.choices[0]?.message?.content || ''
				msgs.push({ role: 'assistant', content })
				console.log(`\n${content}\n`)
			}
		} catch (error) {
			console.error('\nError:', error instanceof Error ? error.message : String(error))
		}
		rl.prompt()
	}
	console.log('\nBye')
	rl.close()
}

export async function runSingle(prompt: string, useCli: boolean, stream: boolean) {
	const apiKey = process.env.KIMI_API_KEY
	if (!apiKey && !useCli) {
		console.error('Error: KIMI_API_KEY not found.')
		console.error(
			'       Set it via environment variable, or ensure briar-assets/briar/.env exists.',
		)
		console.error('       Use --cli to run via local kimi CLI instead.')
		process.exit(1)
	}

	const kimi = new KimiCode({ apiKey: apiKey || undefined })

	try {
		if (useCli) {
			if (stream) {
				for await (const chunk of kimi.executeStream(prompt)) {
					process.stdout.write(`${chunk}\n`)
				}
			} else {
				const result = await kimi.execute(prompt)
				console.log(result)
			}
		} else {
			if (stream) {
				for await (const chunk of kimi.chat.completions.createStream({
					model: 'claude-3-5-sonnet-20241022',
					messages: [{ role: 'user', content: prompt }],
				})) {
					const content = chunk.choices[0]?.delta?.content
					if (content) process.stdout.write(content)
				}
				console.log()
			} else {
				const response = await kimi.chat.completions.create({
					model: 'claude-3-5-sonnet-20241022',
					messages: [{ role: 'user', content: prompt }],
				})
				console.log(response.choices[0]?.message?.content)
			}
		}
	} catch (error) {
		console.error('Error:', error instanceof Error ? error.message : String(error))
		process.exit(1)
	}
}
