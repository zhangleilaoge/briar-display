import { spawn } from 'child_process'
import { getAgentDisplayName, getAgentName } from '../agent.js'
import { createSubAgent } from '../sub-agent.js'
import type { CommandContext } from './types.js'

export function handleSubList(trimmed: string, ctx: CommandContext): boolean {
	const list = ctx.appState.subAgents
		.map((a) => {
			const name = getAgentDisplayName(a, ctx.appState.subAgents)
			const outLen = a.output.join('').length
			return `${name} [${a.status}] — ${a.prompt}\n  输出: ${outLen} chars`
		})
		.join('\n')
	ctx.appState.addSystemMessage(trimmed, list || 'No sub-agents running.')
	ctx.appState.setInputValue('')
	return true
}

export function handleSubView(trimmed: string, ctx: CommandContext): boolean {
	const idOrName = trimmed.slice(9).trim()
	if (!idOrName) {
		ctx.appState.addSystemMessage(trimmed, 'Usage: /sub-view <id|name>')
		ctx.appState.setInputValue('')
		return true
	}
	let agent = ctx.appState.subAgents.find((a) => a.id === Number.parseInt(idOrName))
	if (!agent) {
		agent = ctx.appState.subAgents.find((a) => a.name.toLowerCase() === idOrName.toLowerCase())
	}
	const content = agent
		? `${getAgentDisplayName(agent, ctx.appState.subAgents)} [${agent.status}]:\n${agent.output.slice(-20).join('')}`
		: `${idOrName} not found.`
	ctx.appState.addSystemMessage(trimmed, content)
	ctx.appState.setInputValue('')
	return true
}

export function handleSubChat(trimmed: string, ctx: CommandContext): boolean {
	const rest = trimmed.slice(8).trim()
	const spaceIdx = rest.indexOf(' ')
	const idOrName = spaceIdx > 0 ? rest.slice(0, spaceIdx) : rest
	const prompt = spaceIdx > 0 ? rest.slice(spaceIdx + 1).trim() : ''
	let agent = ctx.appState.subAgents.find((a) => a.id === Number.parseInt(idOrName))
	if (!agent) {
		agent = ctx.appState.subAgents.find((a) => a.name.toLowerCase() === idOrName.toLowerCase())
	}

	if (!agent || !idOrName) {
		ctx.appState.addSystemMessage(trimmed, 'Usage: /subChat <id|name> <prompt>')
		ctx.appState.setInputValue('')
		return true
	}
	if (!agent.sessionId) {
		ctx.appState.addSystemMessage(trimmed, `${agent.name} has no session ID. Cannot resume.`)
		ctx.appState.setInputValue('')
		return true
	}

	ctx.appState.setSubAgents((prev) => {
		const next = [...prev]
		const target = next.find((x) => x.id === agent!.id)
		if (target) target.status = 'running'
		return next
	})
	ctx.appState.setInputValue('')
	ctx.appState.setIsLoading(true)

	const resumeChild = spawn(
		'kimi',
		['-r', agent.sessionId, '-y', '--quiet', '-p', prompt || 'continue'],
		{ env: { ...process.env } },
	)
	const resumeOutput: string[] = []

	const filterResume = (text: string): string => {
		return text
			.split('\n')
			.filter((line) => !line.includes('To resume this session:'))
			.join('\n')
	}

	const appendOutput = (text: string) => {
		if (!text) return
		resumeOutput.push(text)
		ctx.appState.setSubAgents((prev) => {
			const next = [...prev]
			const target = next.find((x) => x.id === agent!.id)
			if (target) target.output.push(text)
			return next
		})
	}

	resumeChild.stdout?.on('data', (data: Buffer) => appendOutput(filterResume(String(data))))
	resumeChild.stderr?.on('data', (data: Buffer) => appendOutput(filterResume(String(data))))
	resumeChild.on('close', (code) => {
		ctx.appState.setIsLoading(false)
		const result = resumeOutput.join('').trim()
		const a = ctx.appState.subAgents.find((x) => x.id === agent!.id)
		const displayName = a ? getAgentDisplayName(a, ctx.appState.subAgents) : agent!.name
		ctx.appState.setSubAgents((prev) => {
			const next = [...prev]
			const target = next.find((x) => x.id === agent!.id)
			if (target) target.status = code === 0 ? 'done' : 'error'
			return next
		})
		if (code === 0 && result) {
			ctx.appState.setMessages((prev) => [
				...prev,
				{
					role: 'assistant',
					sender: agent!.name,
					senderId: agent!.id,
					content: `[${displayName} continued]\n\n${result}`,
				},
			])
		} else if (code !== 0) {
			ctx.appState.setMessages((prev) => [
				...prev,
				{
					role: 'assistant',
					sender: agent!.name,
					senderId: agent!.id,
					content: `[${displayName} failed]\n\n${result || 'No output'}`,
				},
			])
		}
	})
	return true
}

export function handleSub(trimmed: string, ctx: CommandContext): boolean {
	const prompt = trimmed.slice(4).trim()
	if (!prompt) {
		ctx.appState.addSystemMessage(trimmed, 'Usage: /sub <prompt>')
		ctx.appState.setInputValue('')
		return true
	}
	const id = createSubAgent(prompt, {
		onAgentUpdate: ctx.appState.setSubAgents,
		onMessage: (msg) => ctx.appState.setMessages((prev) => [...prev, msg]),
		subAgents: ctx.appState.subAgents,
		nextIdRef: ctx.appState.nextSubAgentIdRef,
	})
	const displayName = getAgentDisplayName(
		{ id, name: getAgentName(id), prompt, status: 'running', output: [] },
		ctx.appState.subAgents,
	)
	ctx.appState.addSystemMessage(trimmed, `Created ${displayName}: ${prompt}`)
	ctx.appState.setInputValue('')
	return true
}
