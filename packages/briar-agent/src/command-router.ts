import { spawn } from 'child_process'
import { getAgentDisplayName, getAgentName } from './agent.js'
import { sendChatMessage } from './chat.js'
import type { KimiCode } from './client/index.js'
import { getHelpText } from './commands.js'
import type { Session } from './session.js'
import { createSession, getSessions, saveCurrentSession, saveSessions } from './session.js'
import { createSubAgent } from './sub-agent.js'
import type { FocusArea, Message, SubAgent } from './types.js'

export interface RouterCtx {
	kimi: KimiCode
	useCli: boolean
	streamMode: boolean
	isLoading: boolean
	exit: () => void
	messages: Message[]
	subAgents: SubAgent[]
	currentSessionId: string
	abortCtrlRef: React.MutableRefObject<AbortController | null>
	nextSubAgentIdRef: React.MutableRefObject<number>
	setMessages: React.Dispatch<React.SetStateAction<Message[]>>
	setSubAgents: React.Dispatch<React.SetStateAction<SubAgent[]>>
	setIsLoading: React.Dispatch<React.SetStateAction<boolean>>
	setInputValue: React.Dispatch<React.SetStateAction<string>>
	setFocus: React.Dispatch<React.SetStateAction<FocusArea>>
	setAllSessions: React.Dispatch<React.SetStateAction<Session[]>>
	setSelectedSubAgentIndex: React.Dispatch<React.SetStateAction<number>>
	setSelectedSessionIndex: React.Dispatch<React.SetStateAction<number>>
	setCurrentSessionId: (id: string) => void
	setCurrentSessionIdState: React.Dispatch<React.SetStateAction<string>>
	archiveCurrentSession: () => void
}

function addSystemMessage(ctx: RouterCtx, userContent: string, assistantContent: string) {
	ctx.setMessages((prev) => [
		...prev,
		{ role: 'user', content: userContent },
		{ role: 'assistant', content: assistantContent },
	])
}

export async function handleCommand(trimmed: string, ctx: RouterCtx): Promise<boolean> {
	if (trimmed === '/exit' || trimmed === '/quit') {
		ctx.exit()
		return true
	}

	// /new
	if (trimmed === '/new') {
		ctx.archiveCurrentSession()
		const s = createSession()
		ctx.setCurrentSessionId(s.id)
		ctx.setCurrentSessionIdState(s.id)
		ctx.setMessages([])
		ctx.setSubAgents([])
		ctx.nextSubAgentIdRef.current = 1
		ctx.setAllSessions(getSessions())
		ctx.setInputValue('')
		return true
	}

	// /session
	if (trimmed === '/session') {
		const sessions = getSessions()
		if (sessions.length <= 1) {
			addSystemMessage(ctx, trimmed, 'No other sessions available.')
			ctx.setInputValue('')
			return true
		}
		ctx.setAllSessions(sessions)
		ctx.setSelectedSessionIndex(sessions.findIndex((s) => s.id === ctx.currentSessionId))
		ctx.setFocus('sessions')
		ctx.setInputValue('')
		return true
	}

	// /session del <id>
	if (trimmed.startsWith('/session del')) {
		const id = trimmed.slice(12).trim()
		if (!id) {
			addSystemMessage(ctx, trimmed, 'Usage: /session del <session-id>')
			ctx.setInputValue('')
			return true
		}
		const sessions = getSessions()
		const idx = sessions.findIndex((s) => s.id === id)
		if (idx < 0) {
			addSystemMessage(ctx, trimmed, `Session ${id} not found.`)
			ctx.setInputValue('')
			return true
		}
		sessions.splice(idx, 1)
		saveSessions(sessions)
		ctx.setAllSessions(sessions)
		if (id === ctx.currentSessionId) {
			const remaining = sessions[0]
			if (remaining) {
				ctx.setCurrentSessionId(remaining.id)
				ctx.setCurrentSessionIdState(remaining.id)
				ctx.setMessages(remaining.messages)
				ctx.setSubAgents(
					remaining.subAgents.map((a) => ({
						...a,
						status: a.status === 'running' ? 'error' : a.status,
					})),
				)
				ctx.nextSubAgentIdRef.current =
					remaining.subAgents.reduce((max, a) => Math.max(max, a.id), 0) + 1
			} else {
				const s = createSession()
				ctx.setCurrentSessionId(s.id)
				ctx.setCurrentSessionIdState(s.id)
				ctx.setMessages([])
				ctx.setSubAgents([])
				ctx.nextSubAgentIdRef.current = 1
			}
		}
		addSystemMessage(ctx, trimmed, `Session ${id} deleted.`)
		ctx.setInputValue('')
		return true
	}

	// /help
	if (trimmed === '/help') {
		addSystemMessage(ctx, trimmed, getHelpText())
		ctx.setInputValue('')
		return true
	}

	// /sub <prompt>
	if (trimmed.startsWith('/sub')) {
		const prompt = trimmed.slice(4).trim()
		if (!prompt) {
			addSystemMessage(ctx, trimmed, 'Usage: /sub <prompt>')
			ctx.setInputValue('')
			return true
		}
		const id = createSubAgent(prompt, {
			onAgentUpdate: ctx.setSubAgents,
			onMessage: (msg) => ctx.setMessages((prev) => [...prev, msg]),
			subAgents: ctx.subAgents,
			nextIdRef: ctx.nextSubAgentIdRef,
		})
		const displayName = getAgentDisplayName(
			{ id, name: getAgentName(id), prompt, status: 'running', output: [] },
			ctx.subAgents,
		)
		addSystemMessage(ctx, trimmed, `Created ${displayName}: ${prompt}`)
		ctx.setInputValue('')
		return true
	}

	// /sub-list
	if (trimmed === '/sub-list') {
		const list = ctx.subAgents
			.map((a) => `${getAgentDisplayName(a, ctx.subAgents)} [${a.status}]`)
			.join('\n')
		addSystemMessage(ctx, trimmed, list || 'No sub-agents running.')
		ctx.setInputValue('')
		return true
	}

	// /sub-view <id>
	if (trimmed.startsWith('/sub-view')) {
		const id = Number.parseInt(trimmed.slice(9).trim())
		const agent = ctx.subAgents.find((a) => a.id === id)
		const content = agent
			? `${getAgentDisplayName(agent, ctx.subAgents)} [${agent.status}]:\n${agent.output.slice(-20).join('')}`
			: `${getAgentName(id)} not found.`
		addSystemMessage(ctx, trimmed, content)
		ctx.setInputValue('')
		return true
	}

	// /sub-del <id>
	if (trimmed.startsWith('/sub-del')) {
		const id = Number.parseInt(trimmed.slice(8).trim())
		const agent = ctx.subAgents.find((a) => a.id === id)
		if (!agent) {
			addSystemMessage(ctx, trimmed, `${getAgentName(id)} not found.`)
			ctx.setInputValue('')
			return true
		}
		if (agent.process && !agent.process.killed) agent.process.kill()
		ctx.setSubAgents((prev) => prev.filter((a) => a.id !== id))
		addSystemMessage(ctx, trimmed, `${getAgentDisplayName(agent, ctx.subAgents)} deleted.`)
		ctx.setInputValue('')
		return true
	}

	// /subChat <id> <prompt>
	if (trimmed.startsWith('/subChat')) {
		const rest = trimmed.slice(8).trim()
		const spaceIdx = rest.indexOf(' ')
		const idStr = spaceIdx > 0 ? rest.slice(0, spaceIdx) : rest
		const prompt = spaceIdx > 0 ? rest.slice(spaceIdx + 1).trim() : ''
		const id = Number.parseInt(idStr)
		const agent = ctx.subAgents.find((a) => a.id === id)

		if (!agent || !idStr) {
			addSystemMessage(ctx, trimmed, 'Usage: /subChat <id> <prompt>')
			ctx.setInputValue('')
			return true
		}
		if (!agent.sessionId) {
			addSystemMessage(ctx, trimmed, `${getAgentName(id)} has no session ID. Cannot resume.`)
			ctx.setInputValue('')
			return true
		}

		addSystemMessage(ctx, trimmed, `Resuming ${getAgentName(id)}...`)
		ctx.setInputValue('')
		ctx.setIsLoading(true)

		const resumeChild = spawn(
			'kimi',
			['-r', agent.sessionId, '-y', '--quiet', '-p', prompt || 'continue'],
			{ env: { ...process.env } },
		)
		const resumeOutput: string[] = []

		resumeChild.stdout?.on('data', (data: Buffer) => resumeOutput.push(String(data)))
		resumeChild.stderr?.on('data', (data: Buffer) => resumeOutput.push(String(data)))
		resumeChild.on('close', (code) => {
			ctx.setIsLoading(false)
			const result = resumeOutput.join('').trim()
			const a = ctx.subAgents.find((x) => x.id === id)
			const displayName = a ? getAgentDisplayName(a, ctx.subAgents) : getAgentName(id)
			if (code === 0 && result) {
				ctx.setMessages((prev) => [
					...prev,
					{
						role: 'assistant',
						sender: getAgentName(id),
						senderId: id,
						content: `[${displayName} continued]\n\n${result}`,
					},
				])
			} else if (code !== 0) {
				ctx.setMessages((prev) => [
					...prev,
					{
						role: 'assistant',
						sender: getAgentName(id),
						senderId: id,
						content: `[${displayName} failed]\n\n${result || 'No output'}`,
					},
				])
			}
		})
		return true
	}

	// regular chat
	ctx.setMessages((prev) => [...prev, { role: 'user', content: trimmed }])
	ctx.setIsLoading(true)
	const abortController = new AbortController()
	ctx.abortCtrlRef.current = abortController

	try {
		const onStreamUpdate = (content: string) => {
			ctx.setMessages((prev) => {
				const next = [...prev]
				const last = next[next.length - 1]
				if (last && last.role === 'assistant') {
					next[next.length - 1] = { ...last, content }
				} else {
					next.push({ role: 'assistant', content })
				}
				return next
			})
		}

		const result = await sendChatMessage({
			kimi: ctx.kimi,
			useCli: ctx.useCli,
			streamMode: ctx.streamMode,
			messages: ctx.messages,
			prompt: trimmed,
			abortSignal: abortController.signal,
			onStreamUpdate,
		})

		if (!ctx.streamMode) {
			ctx.setMessages((prev) => {
				const next = [...prev]
				const last = next[next.length - 1]
				if (last && last.role === 'assistant') {
					next[next.length - 1] = { ...last, content: result }
				} else {
					next.push({ role: 'assistant', content: result })
				}
				return next
			})
		}
	} catch (error) {
		ctx.setMessages((prev) => [
			...prev,
			{
				role: 'assistant',
				content: `Error: ${error instanceof Error ? error.message : String(error)}`,
			},
		])
	} finally {
		ctx.setIsLoading(false)
		ctx.abortCtrlRef.current = null
	}

	return true
}
