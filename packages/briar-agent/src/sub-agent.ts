import { spawn } from 'child_process'
import { getAgentDisplayName, getAgentName } from './agent.js'
import type { SubAgent } from './types.js'

export interface CreateSubAgentOptions {
	onAgentUpdate: (updater: (prev: SubAgent[]) => SubAgent[]) => void
	onMessage: (msg: {
		role: 'user' | 'assistant'
		content: string
		sender?: string
		senderId?: number
	}) => void
	subAgents: SubAgent[]
	nextIdRef: { current: number }
}

export function createSubAgent(prompt: string, options: CreateSubAgentOptions): number {
	const id = options.nextIdRef.current++
	const name = getAgentName(id)
	const child = spawn('kimi', ['-y', '--quiet', '-p', prompt], { env: { ...process.env } })

	const outputBuffer: string[] = []
	let sessionId: string | undefined
	const newAgent: SubAgent = { id, name, prompt, status: 'running', output: [], process: child }

	options.onAgentUpdate((prev) => [...prev, newAgent])

	const filterResume = (text: string): string => {
		const lines = text.split('\n')
		const filtered: string[] = []
		for (const line of lines) {
			if (line.includes('To resume this session:')) {
				const match = line.match(/kimi -r ([a-f0-9-]+)/)
				if (match) sessionId = match[1]
				continue
			}
			filtered.push(line)
		}
		return filtered.join('\n')
	}

	const appendOutput = (text: string) => {
		if (!text) return
		outputBuffer.push(text)
		options.onAgentUpdate((prev) => {
			const next = [...prev]
			const a = next.find((x) => x.id === id)
			if (a) {
				a.output.push(text)
				if (sessionId) a.sessionId = sessionId
			}
			return next
		})
	}

	child.stdout?.on('data', (data: Buffer) => appendOutput(filterResume(String(data))))
	child.stderr?.on('data', (data: Buffer) => appendOutput(filterResume(String(data))))

	child.on('close', (code) => {
		options.onAgentUpdate((prev) => {
			const next = [...prev]
			const a = next.find((x) => x.id === id)
			if (a) {
				a.status = code === 0 ? 'done' : 'error'
				if (sessionId) a.sessionId = sessionId
			}
			return next
		})

		const full = outputBuffer.join('').trim()
		if (!full) return
		const MAX = 3000
		const display =
			full.length > MAX
				? `${full.slice(0, MAX)}\n\n... (${full.length - MAX} more chars, use /sub-view ${id} for full output)`
				: full
		const all = [...options.subAgents, newAgent]
		const displayName = getAgentDisplayName(newAgent, all)
		const label = code === 0 ? 'result' : 'failed'
		options.onMessage({
			role: 'assistant',
			sender: name,
			senderId: id,
			content: `[${displayName} ${label}]\n\n${display}`,
		})
	})

	return id
}
