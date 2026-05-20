import { useState, useRef, useCallback } from 'react'
import { COMMANDS } from '../commands.js'
import type { CommandDef, FocusArea, Message, SubAgent } from '../types.js'

export interface AppState {
	// state
	messages: Message[]
	inputValue: string
	isLoading: boolean
	subAgents: SubAgent[]
	focus: FocusArea
	selectedSubAgentIndex: number
	selectedSessionIndex: number
	allSessions: import('../types.js').Session[]
	currentSessionId: string
	completionMode: boolean
	completionIndex: number
	completionItems: CommandDef[]
	scrollInfo: { offset: number; content: number; viewport: number }

	// refs
	abortCtrlRef: React.MutableRefObject<AbortController | null>
	nextSubAgentIdRef: React.MutableRefObject<number>
	historyIndexRef: React.MutableRefObject<number>

	// actions
	addMessage: (msg: Message) => void
	addSystemMessage: (userContent: string, assistantContent: string) => void
	setMessages: React.Dispatch<React.SetStateAction<Message[]>>
	clearMessages: () => void
	setInputValue: React.Dispatch<React.SetStateAction<string>>
	setIsLoading: React.Dispatch<React.SetStateAction<boolean>>
	setSubAgents: React.Dispatch<React.SetStateAction<SubAgent[]>>
	addSubAgent: (agent: SubAgent) => void
	updateSubAgent: (id: number, updater: (agent: SubAgent) => void) => void
	removeSubAgent: (id: number) => void
	clearSubAgents: () => void
	setFocus: React.Dispatch<React.SetStateAction<FocusArea>>
	setSelectedSubAgentIndex: React.Dispatch<React.SetStateAction<number>>
	setSelectedSessionIndex: React.Dispatch<React.SetStateAction<number>>
	setAllSessions: React.Dispatch<React.SetStateAction<import('../types.js').Session[]>>
	setCurrentSessionIdState: React.Dispatch<React.SetStateAction<string>>
	enterCompletion: (prefix: string) => void
	exitCompletion: () => void
	nextCompletion: () => void
	prevCompletion: () => void
	setScrollInfo: React.Dispatch<React.SetStateAction<{ offset: number; content: number; viewport: number }>>
	cancelRequest: () => void
}

export function useAppState(): AppState {
	const [messages, setMessages] = useState<Message[]>([])
	const [inputValue, setInputValue] = useState('')
	const [isLoading, setIsLoading] = useState(false)
	const [subAgents, setSubAgents] = useState<SubAgent[]>([])
	const [focus, setFocus] = useState<FocusArea>('chat')
	const [selectedSubAgentIndex, setSelectedSubAgentIndex] = useState(0)
	const [selectedSessionIndex, setSelectedSessionIndex] = useState(0)
	const [allSessions, setAllSessions] = useState<import('../types.js').Session[]>([])
	const [currentSessionId, setCurrentSessionIdState] = useState('')
	const [completionMode, setCompletionMode] = useState(false)
	const [completionIndex, setCompletionIndex] = useState(0)
	const [completionItems, setCompletionItems] = useState<CommandDef[]>([])
	const [scrollInfo, setScrollInfo] = useState({ offset: 0, content: 0, viewport: 0 })

	const abortCtrlRef = useRef<AbortController | null>(null)
	const nextSubAgentIdRef = useRef(1)
	const historyIndexRef = useRef(-1)

	const addMessage = useCallback((msg: Message) => {
		setMessages((prev) => [...prev, msg])
	}, [])

	const addSystemMessage = useCallback((userContent: string, assistantContent: string) => {
		setMessages((prev) => [
			...prev,
			{ role: 'user', content: userContent },
			{ role: 'assistant', content: assistantContent },
		])
	}, [])

	const clearMessages = useCallback(() => setMessages([]), [])

	const addSubAgent = useCallback((agent: SubAgent) => {
		setSubAgents((prev) => [...prev, agent])
	}, [])

	const updateSubAgent = useCallback((id: number, updater: (agent: SubAgent) => void) => {
		setSubAgents((prev) => {
			const next = [...prev]
			const agent = next.find((a) => a.id === id)
			if (agent) updater(agent)
			return next
		})
	}, [])

	const removeSubAgent = useCallback((id: number) => {
		setSubAgents((prev) => {
			const next = prev.filter((a) => a.id !== id)
			return next
		})
	}, [])

	const clearSubAgents = useCallback(() => {
		setSubAgents([])
		nextSubAgentIdRef.current = 1
	}, [])

	const enterCompletion = useCallback((prefix: string) => {
		const items = COMMANDS.filter((c) => c.name.toLowerCase().startsWith(prefix.toLowerCase()))
		setCompletionItems(items)
		setCompletionMode(items.length > 0 && prefix.length > 0)
		setCompletionIndex(0)
	}, [])

	const exitCompletion = useCallback(() => {
		setCompletionMode(false)
	}, [])

	const nextCompletion = useCallback(() => {
		setCompletionIndex((p) => Math.min(completionItems.length - 1, p + 1))
	}, [completionItems.length])

	const prevCompletion = useCallback(() => {
		setCompletionIndex((p) => Math.max(0, p - 1))
	}, [])

	const handleInputChange = useCallback((value: string) => {
		historyIndexRef.current = -1
		setInputValue(value)
		if (value.startsWith('/') && !value.includes(' ')) {
			enterCompletion(value)
		} else {
			exitCompletion()
		}
	}, [enterCompletion, exitCompletion])

	const cancelRequest = useCallback(() => {
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
	}, [])

	return {
		messages,
		inputValue,
		isLoading,
		subAgents,
		focus,
		selectedSubAgentIndex,
		selectedSessionIndex,
		allSessions,
		currentSessionId,
		completionMode,
		completionIndex,
		completionItems,
		scrollInfo,
		abortCtrlRef,
		nextSubAgentIdRef,
		historyIndexRef,
		addMessage,
		addSystemMessage,
		setMessages,
		clearMessages,
		setInputValue,
		setIsLoading,
		setSubAgents,
		addSubAgent,
		updateSubAgent,
		removeSubAgent,
		clearSubAgents,
		setFocus,
		setSelectedSubAgentIndex,
		setSelectedSessionIndex,
		setAllSessions,
		setCurrentSessionIdState,
		enterCompletion,
		exitCompletion,
		nextCompletion,
		prevCompletion,
		setScrollInfo,
		cancelRequest,
		handleInputChange,
	}
}
