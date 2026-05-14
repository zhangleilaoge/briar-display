import { Box, useApp, useInput, useStdout } from 'ink'
import type { ScrollViewRef } from 'ink-scroll-view'
import React, { useState, useRef, useEffect, useCallback } from 'react'
import type { KimiCode } from './client/index.js'
import { type RouterCtx, handleCommand } from './command-router.js'
import { COMMANDS } from './commands.js'
import { ChatPanel } from './components/ChatPanel.js'
import { CompletionPopup } from './components/CompletionPopup.js'
import { Header } from './components/Header.js'
import { InputBar } from './components/InputBar.js'
import { SessionPanel } from './components/SessionPanel.js'
import { SubAgentPanel } from './components/SubAgentPanel.js'
import {
	createSession,
	formatSessionName,
	getCurrentSessionId,
	getSessions,
	loadCurrentSession,
	saveCurrentSession,
	saveSessions,
	setCurrentSessionId,
	stripProcess,
} from './session.js'
import type { FocusArea, Message, SubAgent } from './types.js'

function App({
	kimi,
	useCli,
	streamMode,
}: { kimi: KimiCode; useCli: boolean; streamMode: boolean }) {
	const { exit } = useApp()
	const { stdout } = useStdout()
	const scrollRef = useRef<ScrollViewRef | null>(null)

	// ---- state ----
	const [messages, setMessages] = useState<Message[]>([])
	const [inputValue, setInputValue] = useState('')
	const [isLoading, setIsLoading] = useState(false)
	const [subAgents, setSubAgents] = useState<SubAgent[]>([])
	const [focus, setFocus] = useState<FocusArea>('chat')
	const [selectedSubAgentIndex, setSelectedSubAgentIndex] = useState(0)
	const [selectedSessionIndex, setSelectedSessionIndex] = useState(0)
	const [allSessions, setAllSessions] = useState(getSessions())
	const [currentSessionId, setCurrentSessionIdState] = useState(getCurrentSessionId() || '')
	const [completionMode, setCompletionMode] = useState(false)
	const [completionIndex, setCompletionIndex] = useState(0)
	const [completionItems, setCompletionItems] = useState<typeof COMMANDS>([])

	// ---- refs (mutable state, no re-render) ----
	const abortCtrlRef = useRef<AbortController | null>(null)
	const nextSubAgentIdRef = useRef(1)
	const stickySenderIdRef = useRef<number | undefined>(undefined)

	// ---- derived: sticky label ----
	const stickyLabel = (() => {
		const ref = scrollRef.current
		if (!ref || messages.length === 0) return ''
		const offset = ref.getScrollOffset()
		for (let i = messages.length - 1; i >= 0; i--) {
			const pos = ref.getItemPosition(i)
			if (pos && pos.top <= offset) {
				stickySenderIdRef.current = messages[i].senderId
				return messages[i].role === 'user' ? 'You' : messages[i].sender || 'Briar'
			}
		}
		return ''
	})()

	// ---- effects ----

	useEffect(() => {
		const loaded = loadCurrentSession()
		if (loaded) {
			setMessages(loaded.messages)
			setSubAgents(
				loaded.subAgents.map((a) => ({
					...a,
					status: a.status === 'running' ? 'error' : a.status,
				})),
			)
			nextSubAgentIdRef.current = loaded.subAgents.reduce((max, a) => Math.max(max, a.id), 0) + 1
			setCurrentSessionIdState(loaded.id)
		} else {
			const s = createSession()
			setCurrentSessionId(s.id)
			setCurrentSessionIdState(s.id)
			saveCurrentSession(s)
			setAllSessions(getSessions())
		}
	}, [])

	useEffect(() => {
		const timer = setTimeout(() => {
			if (!currentSessionId) return
			const session = {
				id: currentSessionId,
				name: formatSessionName({
					id: currentSessionId,
					name: 'New session',
					messages,
					subAgents: stripProcess(subAgents),
					createdAt: Date.now(),
					updatedAt: Date.now(),
				}),
				messages,
				subAgents: stripProcess(subAgents),
				createdAt: Date.now(),
				updatedAt: Date.now(),
			}
			saveCurrentSession(session)
			setAllSessions(getSessions())
		}, 300)
		return () => clearTimeout(timer)
	}, [messages, subAgents, currentSessionId])

	useEffect(() => {
		const handler = () => scrollRef.current?.remeasure()
		stdout?.on('resize', handler)
		return () => {
			stdout?.off('resize', handler)
		}
	}, [stdout])

	// ---- helpers ----

	const archiveCurrentSession = useCallback(() => {
		saveCurrentSession({
			id: currentSessionId,
			name: formatSessionName({
				id: currentSessionId,
				name: 'New session',
				messages,
				subAgents: stripProcess(subAgents),
				createdAt: Date.now(),
				updatedAt: Date.now(),
			}),
			messages,
			subAgents: stripProcess(subAgents),
			createdAt: Date.now(),
			updatedAt: Date.now(),
		})
	}, [currentSessionId, messages, subAgents])

	const handleInputChange = useCallback((value: string) => {
		setInputValue(value)
		if (value.startsWith('/') && !value.includes(' ')) {
			const prefix = value.toLowerCase()
			const items = COMMANDS.filter((c) => c.name.toLowerCase().startsWith(prefix))
			setCompletionItems(items)
			setCompletionMode(items.length > 0 && value.length > 0)
			setCompletionIndex(0)
		} else {
			setCompletionMode(false)
		}
	}, [])

	// 处理提交
	const handleSubmit = useCallback(
		async (value: string) => {
			const trimmed = value.trim()
			if (!trimmed || isLoading) return
			setInputValue('')

			const ctx: RouterCtx = {
				kimi,
				useCli,
				streamMode,
				isLoading,
				exit,
				messages,
				subAgents,
				currentSessionId,
				abortCtrlRef,
				nextSubAgentIdRef,
				setMessages,
				setSubAgents,
				setIsLoading,
				setInputValue,
				setFocus,
				setAllSessions,
				setSelectedSubAgentIndex,
				setSelectedSessionIndex,
				setCurrentSessionId,
				setCurrentSessionIdState,
				archiveCurrentSession,
			}

			await handleCommand(trimmed, ctx)
		},
		[
			kimi,
			useCli,
			streamMode,
			isLoading,
			exit,
			messages,
			subAgents,
			currentSessionId,
			archiveCurrentSession,
		],
	)

	// 键盘处理
	useInput((input, key) => {
		if (key.ctrl && input === 'x') {
			if (abortCtrlRef.current) {
				abortCtrlRef.current.abort()
				setIsLoading(false)
				setMessages((prev) => {
					const next = [...prev]
					const last = next[next.length - 1]
					if (last && last.role === 'assistant') {
						next[next.length - 1] = { ...last, cancelled: true }
					} else {
						next.push({ role: 'assistant', content: '[Cancelled]', cancelled: true })
					}
					return next
				})
			}
			return
		}

		if (completionMode) {
			if (key.upArrow) {
				setCompletionIndex((p) => Math.max(0, p - 1))
				return
			}
			if (key.downArrow) {
				setCompletionIndex((p) => Math.min(completionItems.length - 1, p + 1))
				return
			}
			if (key.return || key.tab) {
				const cmd = completionItems[completionIndex]
				if (cmd) {
					setInputValue(`${cmd.name} `)
					setCompletionMode(false)
				}
				return
			}
			if (key.escape) {
				setCompletionMode(false)
				return
			}
		}

		if (focus === 'chat') {
			if (key.rightArrow && inputValue === '' && subAgents.length > 0) {
				setFocus('subAgents')
				setSelectedSubAgentIndex(subAgents.length - 1)
				return
			}
			if (key.upArrow) {
				scrollRef.current?.scrollBy(-3)
			}
			if (key.downArrow) {
				scrollRef.current?.scrollBy(3)
			}
		} else if (focus === 'subAgents') {
			if (key.leftArrow || key.escape) {
				setFocus('chat')
				return
			}
			if (key.upArrow) {
				setSelectedSubAgentIndex((p) => Math.max(0, p - 1))
			}
			if (key.downArrow) {
				setSelectedSubAgentIndex((p) => Math.min(subAgents.length - 1, p + 1))
			}
			if (key.return) {
				const agent = subAgents[selectedSubAgentIndex]
				if (agent) setInputValue(`/subChat ${agent.id} `)
				setFocus('chat')
			}
			if (input === 'd' || key.delete) {
				const agent = subAgents[selectedSubAgentIndex]
				if (agent) {
					if (agent.process && !agent.process.killed) agent.process.kill()
					setSubAgents((prev) => {
						const next = prev.filter((a) => a.id !== agent.id)
						if (selectedSubAgentIndex >= next.length)
							setSelectedSubAgentIndex(Math.max(0, next.length - 1))
						return next
					})
				}
			}
		} else if (focus === 'sessions') {
			if (key.escape || key.leftArrow) {
				setFocus('chat')
				return
			}
			if (key.upArrow) {
				setSelectedSessionIndex((p) => Math.max(0, p - 1))
			}
			if (key.downArrow) {
				setSelectedSessionIndex((p) => Math.min(allSessions.length - 1, p + 1))
			}
			if (key.return) {
				const selected = allSessions[selectedSessionIndex]
				if (selected && selected.id !== currentSessionId) {
					archiveCurrentSession()
					setCurrentSessionId(selected.id)
					setCurrentSessionIdState(selected.id)
					setMessages(selected.messages)
					setSubAgents(
						selected.subAgents.map((a) => ({
							...a,
							status: a.status === 'running' ? 'error' : a.status,
						})),
					)
					nextSubAgentIdRef.current =
						selected.subAgents.reduce((max, a) => Math.max(max, a.id), 0) + 1
					setAllSessions(getSessions())
				}
				setFocus('chat')
			}
		}
	})

	return (
		<Box flexDirection="column" height={stdout.rows}>
			<Header label={stickyLabel} senderId={stickySenderIdRef.current} />

			<Box flexDirection="row" flexGrow={1} overflow="hidden">
				{focus === 'sessions' ? (
					<SessionPanel
						sessions={allSessions}
						selectedIndex={selectedSessionIndex}
						currentId={currentSessionId}
					/>
				) : (
					<ChatPanel
						messages={messages}
						isLoading={isLoading}
						scrollRef={scrollRef}
						onScroll={() => {}}
					/>
				)}
				<SubAgentPanel subAgents={subAgents} focus={focus} selectedIndex={selectedSubAgentIndex} />
			</Box>

			{completionMode && (
				<CompletionPopup items={completionItems} selectedIndex={completionIndex} />
			)}

			<InputBar
				query={inputValue}
				focus={focus}
				completionMode={completionMode}
				onChange={handleInputChange}
				onSubmit={handleSubmit}
			/>
		</Box>
	)
}

export { App }
