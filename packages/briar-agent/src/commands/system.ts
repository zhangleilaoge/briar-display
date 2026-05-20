import { getHelpText } from '../commands.js'
import type { CommandContext } from './types.js'

export function handleExit(_trimmed: string, ctx: CommandContext): boolean {
	ctx.exit()
	return true
}

export function handleClear(_trimmed: string, ctx: CommandContext): boolean {
	for (const agent of ctx.appState.subAgents) {
		if (agent.process && !agent.process.killed) agent.process.kill()
	}
	ctx.appState.clearMessages()
	ctx.appState.clearSubAgents()
	ctx.appState.setInputValue('')
	return true
}

export function handleNew(_trimmed: string, ctx: CommandContext): boolean {
	ctx.sessions.createNewSession()
	ctx.appState.setInputValue('')
	return true
}

export function handleHelp(trimmed: string, ctx: CommandContext): boolean {
	ctx.appState.addSystemMessage(trimmed, getHelpText())
	ctx.appState.setInputValue('')
	return true
}
