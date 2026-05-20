import { Box, useApp, useInput, useStdout } from 'ink'
import type { ScrollViewRef } from 'ink-scroll-view'
import React, { useRef, useEffect, useCallback } from 'react'
import type { KimiCode } from './client/index.js'
import { handleCommand } from './commands/index.js'
import { ChatPanel } from './components/ChatPanel.js'
import { CompletionPopup } from './components/CompletionPopup.js'
import { Header } from './components/Header.js'
import { InputBar } from './components/InputBar.js'
import { SessionPanel } from './components/SessionPanel.js'
import { SubAgentPanel } from './components/SubAgentPanel.js'
import { useAppState } from './hooks/use-app-state.js'
import { useSessionPersistence } from './hooks/use-session-persistence.js'
import { mouseEmitter } from './mouse-stdin.js'

function App({
	kimi,
	useCli,
	streamMode,
}: {
	kimi: KimiCode
	useCli: boolean
	streamMode: boolean
}) {
	const { exit } = useApp()
	const { stdout } = useStdout()
	const scrollRef = useRef<ScrollViewRef | null>(null)
	const stickySenderIdRef = useRef<number | undefined>(undefined)

	const appState = useAppState()
	const sessions = useSessionPersistence(appState)

	// 用 ref 绕过 useEffectEvent 的闭包问题，确保 useInput handler 永远读到最新状态
	const appStateRef = useRef(appState)
	appStateRef.current = appState

	// 提交处理
	const handleSubmit = useCallback(
		async (value: string) => {
			const trimmed = value.trim()
			if (!trimmed || appStateRef.current.isLoading) return
			appStateRef.current.setInputValue('')
			await handleCommand(trimmed, {
				kimi,
				useCli,
				streamMode,
				exit,
				appState: appStateRef.current,
				sessions,
			})
		},
		[kimi, useCli, streamMode, exit, sessions],
	)

	// 键盘事件
	const completionItemsRef = useRef(appState.completionItems)
	completionItemsRef.current = appState.completionItems

	useInput((input, key) => {
		const state = appStateRef.current

		// Ctrl+X: cancel
		if (key.ctrl && input === 'x') {
			state.cancelRequest()
			return
		}

		// Completion mode
		if (state.completionMode) {
			if (key.upArrow) {
				state.prevCompletion()
				return
			}
			if (key.downArrow) {
				state.nextCompletion()
				return
			}
			if (key.return || key.tab) {
				const cmd = completionItemsRef.current[state.completionIndex]
				if (cmd) {
					state.setInputValue(`${cmd.name} `)
					state.exitCompletion()
				}
				return
			}
			if (key.escape) {
				state.exitCompletion()
				return
			}
		}

		// Focus-based navigation
		switch (state.focus) {
			case 'chat': {
				if (key.upArrow && state.inputValue === '') {
					const userMessages = state.messages.filter((m) => m.role === 'user')
					if (userMessages.length > 0) {
						state.historyIndexRef.current = Math.min(
							state.historyIndexRef.current + 1,
							userMessages.length - 1,
						)
						const msg = userMessages[userMessages.length - 1 - state.historyIndexRef.current]
						if (msg) state.setInputValue(msg.content)
					}
					return
				}
				if (key.downArrow && state.inputValue === '') {
					const userMessages = state.messages.filter((m) => m.role === 'user')
					if (userMessages.length > 0) {
						state.historyIndexRef.current = Math.max(-1, state.historyIndexRef.current - 1)
						if (state.historyIndexRef.current < 0) {
							state.setInputValue('')
						} else {
							const msg = userMessages[userMessages.length - 1 - state.historyIndexRef.current]
							if (msg) state.setInputValue(msg.content)
						}
					}
					return
				}
				if (key.rightArrow && state.inputValue === '' && state.subAgents.length > 0) {
					state.setFocus('subAgents')
					state.setSelectedSubAgentIndex(state.subAgents.length - 1)
					return
				}
				return
			}

			case 'subAgents': {
				if (key.leftArrow || key.escape) {
					state.setFocus('chat')
					return
				}
				if (key.upArrow) {
					state.setSelectedSubAgentIndex((p) => Math.max(0, p - 1))
					return
				}
				if (key.downArrow) {
					state.setSelectedSubAgentIndex((p) => Math.min(state.subAgents.length - 1, p + 1))
					return
				}
				if (key.return) {
					const agent = state.subAgents[state.selectedSubAgentIndex]
					if (agent) state.setInputValue(`/subChat ${agent.name} `)
					state.setFocus('chat')
					return
				}
				if (input === 'd' || key.delete) {
					const idx = state.selectedSubAgentIndex
					const agent = state.subAgents[idx]
					if (agent) {
						if (agent.process && !agent.process.killed) agent.process.kill()
						const nextLength = state.subAgents.length - 1
						const nextIndex = idx >= nextLength ? Math.max(0, nextLength - 1) : idx
						state.removeSubAgent(agent.id)
						state.setSelectedSubAgentIndex(nextIndex)
					}
					return
				}
				return
			}

			case 'sessions': {
				if (key.escape || key.leftArrow) {
					state.setFocus('chat')
					return
				}
				if (key.upArrow) {
					state.setSelectedSessionIndex((p) => Math.max(0, p - 1))
					return
				}
				if (key.downArrow) {
					state.setSelectedSessionIndex((p) => Math.min(state.allSessions.length - 1, p + 1))
					return
				}
				if (key.return) {
					const selected = state.allSessions[state.selectedSessionIndex]
					if (selected && selected.id !== state.currentSessionId) {
						sessions.switchToSession(selected.id)
					}
					state.setFocus('chat')
					return
				}
				if (input === 'd' || key.delete) {
					const selected = state.allSessions[state.selectedSessionIndex]
					if (!selected) return
					sessions.deleteSession(selected.id)
					state.setSelectedSessionIndex((p) =>
						Math.max(0, Math.min(p, state.allSessions.length - 1)),
					)
					return
				}
				return
			}
		}
	})

	// 终端 resize
	useEffect(() => {
		const handler = () => scrollRef.current?.remeasure()
		stdout?.on('resize', handler)
		return () => {
			stdout?.off('resize', handler)
		}
	}, [stdout])

	// 鼠标滚轮
	useEffect(() => {
		const onWheel = (dir: string) => {
			if (dir === 'up') scrollRef.current?.scrollBy(-3)
			else if (dir === 'down') scrollRef.current?.scrollBy(3)
		}
		mouseEmitter.on('wheel', onWheel)
		return () => {
			mouseEmitter.off('wheel', onWheel)
		}
	}, [])

	// Sticky label
	const stickyLabel = (() => {
		const ref = scrollRef.current
		if (!ref || appState.messages.length === 0) return ''
		const offset = ref.getScrollOffset()
		for (let i = appState.messages.length - 1; i >= 0; i--) {
			const pos = ref.getItemPosition(i)
			if (pos && pos.top <= offset) {
				stickySenderIdRef.current = appState.messages[i].senderId
				return appState.messages[i].role === 'user' ? 'You' : appState.messages[i].sender || 'Briar'
			}
		}
		return ''
	})()

	return (
		<Box flexDirection="column" height={stdout.rows}>
			<Header
				label={stickyLabel}
				senderId={stickySenderIdRef.current}
				scrollInfo={appState.scrollInfo}
			/>

			<Box flexDirection="row" flexGrow={1} overflow="hidden">
				{appState.focus === 'sessions' ? (
					<SessionPanel
						sessions={appState.allSessions}
						selectedIndex={appState.selectedSessionIndex}
						currentId={appState.currentSessionId}
					/>
				) : (
					<ChatPanel
						messages={appState.messages}
						isLoading={appState.isLoading}
						scrollRef={scrollRef}
						onScroll={(offset: number) => {
							const ref = scrollRef.current
							if (!ref) return
							appState.setScrollInfo({
								offset,
								content: ref.getContentHeight(),
								viewport: ref.getViewportHeight(),
							})
						}}
						onContentHeightChange={() => {
							const ref = scrollRef.current
							if (!ref) return
							appState.setScrollInfo({
								offset: ref.getScrollOffset(),
								content: ref.getContentHeight(),
								viewport: ref.getViewportHeight(),
							})
						}}
					/>
				)}
				<SubAgentPanel
					subAgents={appState.subAgents}
					focus={appState.focus}
					selectedIndex={appState.selectedSubAgentIndex}
				/>
			</Box>

			<Box flexDirection="column" flexShrink={0}>
				{appState.completionMode && (
					<CompletionPopup
						items={appState.completionItems}
						selectedIndex={appState.completionIndex}
					/>
				)}
				<InputBar
					query={appState.inputValue}
					focus={appState.focus}
					completionMode={appState.completionMode}
					onChange={appState.handleInputChange}
					onSubmit={handleSubmit}
				/>
			</Box>
		</Box>
	)
}

export { App }
