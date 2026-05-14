import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { resolve } from 'path'
import type { Session, SubAgent } from './types.js'

const BRIAR_DIR = resolve(homedir(), '.briar')
const SESSIONS_FILE = resolve(BRIAR_DIR, 'sessions.json')
const CURRENT_FILE = resolve(BRIAR_DIR, 'current')

export function getSessions(): Session[] {
	try {
		return JSON.parse(readFileSync(SESSIONS_FILE, 'utf-8')) as Session[]
	} catch {
		return []
	}
}

export function saveSessions(sessions: Session[]) {
	try {
		mkdirSync(BRIAR_DIR, { recursive: true })
		writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, '\t'))
	} catch {
		// ignore
	}
}

export function getCurrentSessionId(): string | null {
	try {
		const id = readFileSync(CURRENT_FILE, 'utf-8').trim()
		return id || null
	} catch {
		return null
	}
}

export function setCurrentSessionId(id: string) {
	try {
		mkdirSync(BRIAR_DIR, { recursive: true })
		writeFileSync(CURRENT_FILE, id)
	} catch {
		// ignore
	}
}

export function createSession(name = 'New session'): Session {
	return {
		id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
		name,
		messages: [],
		subAgents: [],
		createdAt: Date.now(),
		updatedAt: Date.now(),
	}
}

export function saveCurrentSession(session: Session) {
	const sessions = getSessions()
	const idx = sessions.findIndex((s) => s.id === session.id)
	if (idx >= 0) {
		sessions[idx] = session
	} else {
		sessions.push(session)
	}
	saveSessions(sessions)
}

export function loadCurrentSession(): Session | null {
	const id = getCurrentSessionId()
	if (!id) return null
	const sessions = getSessions()
	return sessions.find((s) => s.id === id) || null
}

export function formatSessionName(session: Session): string {
	if (session.name !== 'New session') return session.name
	const firstUser = session.messages.find((m) => m.role === 'user')
	if (firstUser) {
		const snippet = firstUser.content.slice(0, 30)
		return snippet + (firstUser.content.length > 30 ? '...' : '')
	}
	return 'New session'
}

export function stripProcess(subAgents: SubAgent[]) {
	return subAgents.map(({ process: _, ...rest }) => rest)
}
