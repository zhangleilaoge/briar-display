import { useCallback, useEffect } from 'react'
import {
	createSession,
	formatSessionName,
	getSessions,
	loadCurrentSession,
	saveCurrentSession,
	saveSessions,
	setCurrentSessionId,
	stripProcess,
} from '../session.js'
import type { AppState } from './use-app-state.js'

export interface SessionPersistence {
	archiveCurrentSession: () => void
	switchToSession: (id: string) => void
	deleteSession: (id: string) => void
	createNewSession: () => void
}

export function useSessionPersistence(appState: AppState): SessionPersistence {
	// 初始化：加载当前会话或创建新会话
	useEffect(() => {
		const loaded = loadCurrentSession()
		if (loaded) {
			appState.setMessages(loaded.messages)
			appState.setSubAgents(
				loaded.subAgents.map((a) => ({
					...a,
					status: a.status === 'running' ? 'error' : a.status,
				})),
			)
			appState.nextSubAgentIdRef.current =
				loaded.subAgents.reduce((max, a) => Math.max(max, a.id), 0) + 1
			appState.setCurrentSessionIdState(loaded.id)
		} else {
			const s = createSession()
			setCurrentSessionId(s.id)
			appState.setCurrentSessionIdState(s.id)
			saveCurrentSession(s)
			appState.setAllSessions(getSessions())
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	// 自动保存当前会话
	useEffect(() => {
		const timer = setTimeout(() => {
			if (!appState.currentSessionId) return
			const session = {
				id: appState.currentSessionId,
				name: formatSessionName({
					id: appState.currentSessionId,
					name: 'New session',
					messages: appState.messages,
					subAgents: stripProcess(appState.subAgents),
					createdAt: Date.now(),
					updatedAt: Date.now(),
				}),
				messages: appState.messages,
				subAgents: stripProcess(appState.subAgents),
				createdAt: Date.now(),
				updatedAt: Date.now(),
			}
			saveCurrentSession(session)
			appState.setAllSessions(getSessions())
		}, 300)
		return () => clearTimeout(timer)
	}, [appState.messages, appState.subAgents, appState.currentSessionId])

	const archiveCurrentSession = useCallback(() => {
		if (!appState.currentSessionId) return
		saveCurrentSession({
			id: appState.currentSessionId,
			name: formatSessionName({
				id: appState.currentSessionId,
				name: 'New session',
				messages: appState.messages,
				subAgents: stripProcess(appState.subAgents),
				createdAt: Date.now(),
				updatedAt: Date.now(),
			}),
			messages: appState.messages,
			subAgents: stripProcess(appState.subAgents),
			createdAt: Date.now(),
			updatedAt: Date.now(),
		})
	}, [appState.currentSessionId, appState.messages, appState.subAgents])

	const switchToSession = useCallback(
		(id: string) => {
			archiveCurrentSession()
			setCurrentSessionId(id)
			appState.setCurrentSessionIdState(id)
			const sessions = getSessions()
			const target = sessions.find((s) => s.id === id)
			if (target) {
				appState.setMessages(target.messages)
				appState.setSubAgents(
					target.subAgents.map((a) => ({
						...a,
						status: a.status === 'running' ? 'error' : a.status,
					})),
				)
				appState.nextSubAgentIdRef.current =
					target.subAgents.reduce((max, a) => Math.max(max, a.id), 0) + 1
			}
			appState.setAllSessions(getSessions())
		},
		[archiveCurrentSession, appState],
	)

	const deleteSession = useCallback(
		(id: string) => {
			const sessions = getSessions()
			const idx = sessions.findIndex((s) => s.id === id)
			if (idx >= 0) sessions.splice(idx, 1)
			saveSessions(sessions)
			appState.setAllSessions(sessions)

			if (id === appState.currentSessionId) {
				const remaining = sessions[0]
				if (remaining) {
					setCurrentSessionId(remaining.id)
					appState.setCurrentSessionIdState(remaining.id)
					appState.setMessages(remaining.messages)
					appState.setSubAgents(
						remaining.subAgents.map((a) => ({
							...a,
							status: a.status === 'running' ? 'error' : a.status,
						})),
					)
					appState.nextSubAgentIdRef.current =
						remaining.subAgents.reduce((max, a) => Math.max(max, a.id), 0) + 1
				} else {
					const s = createSession()
					appState.setCurrentSessionId(s.id)
					appState.setCurrentSessionIdState(s.id)
					appState.setMessages([])
					appState.setSubAgents([])
					appState.nextSubAgentIdRef.current = 1
				}
			}
		},
		[appState],
	)

	const createNewSession = useCallback(() => {
		archiveCurrentSession()
		const s = createSession()
		appState.setCurrentSessionId(s.id)
		appState.setCurrentSessionIdState(s.id)
		appState.setMessages([])
		appState.setSubAgents([])
		appState.nextSubAgentIdRef.current = 1
		appState.setAllSessions(getSessions())
	}, [archiveCurrentSession, appState])

	return { archiveCurrentSession, switchToSession, deleteSession, createNewSession }
}
