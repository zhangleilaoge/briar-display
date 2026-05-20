import { getSessions } from '../session.js'
import type { CommandContext } from './types.js'

export function handleSession(trimmed: string, ctx: CommandContext): boolean {
	const sessions = getSessions()
	if (sessions.length <= 1) {
		ctx.appState.addSystemMessage(trimmed, 'No other sessions available.')
		ctx.appState.setInputValue('')
		return true
	}
	ctx.appState.setAllSessions(sessions)
	ctx.appState.setSelectedSessionIndex(
		sessions.findIndex((s) => s.id === ctx.appState.currentSessionId),
	)
	ctx.appState.setFocus('sessions')
	ctx.appState.setInputValue('')
	return true
}

export function handleSessionDel(trimmed: string, ctx: CommandContext): boolean {
	const id = trimmed.slice(12).trim()
	if (!id) {
		ctx.appState.addSystemMessage(trimmed, 'Usage: /session del <session-id>')
		ctx.appState.setInputValue('')
		return true
	}
	ctx.sessions.deleteSession(id)
	ctx.appState.addSystemMessage(trimmed, `Session ${id} deleted.`)
	ctx.appState.setInputValue('')
	return true
}
