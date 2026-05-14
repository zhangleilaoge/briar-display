import type { ChildProcess } from 'child_process'

export interface Message {
	role: 'user' | 'assistant'
	content: string
	sender?: string
	senderId?: number
	cancelled?: boolean
}

export interface SubAgent {
	id: number
	name: string
	prompt: string
	status: 'running' | 'done' | 'error'
	output: string[]
	process?: ChildProcess
	sessionId?: string
}

export interface Session {
	id: string
	name: string
	messages: Message[]
	subAgents: Omit<SubAgent, 'process'>[]
	createdAt: number
	updatedAt: number
}

export type FocusArea = 'chat' | 'subAgents' | 'sessions'

export interface CommandDef {
	name: string
	desc: string
}
