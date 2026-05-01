import { AsyncLocalStorage } from 'async_hooks'

export interface ToolParameter {
	type: string
	description: string
	enum?: string[]
}

export interface ToolParameters {
	type: 'object'
	properties: Record<string, ToolParameter>
	required?: string[]
}

export interface ToolDefinition {
	name: string
	description: string
	input_schema: ToolParameters
}

export interface ToolCall {
	id: string
	name: string
	input: Record<string, unknown>
}

export type ToolHandler = (args: Record<string, unknown>) => Promise<string> | string

class ToolRegistry {
	private definitions: Map<string, ToolDefinition> = new Map()
	private handlers: Map<string, ToolHandler> = new Map()

	register(definition: ToolDefinition, handler: ToolHandler) {
		const name = definition.name
		this.definitions.set(name, definition)
		this.handlers.set(name, handler)
	}

	unregister(name: string) {
		this.definitions.delete(name)
		this.handlers.delete(name)
	}

	getDefinitions(): ToolDefinition[] {
		return Array.from(this.definitions.values())
	}

	getHandler(name: string): ToolHandler | undefined {
		return this.handlers.get(name)
	}

	listTools(): string[] {
		return Array.from(this.definitions.keys())
	}
}

export const toolRegistry = new ToolRegistry()

// ===== 子代理上下文传递 =====
// 用于让工具 handler 知道当前是哪个子代理在调用，从而给日志加前缀
const agentContext = new AsyncLocalStorage<{ prefix: string }>()

export function runWithAgentContext<T>(prefix: string, fn: () => Promise<T>): Promise<T> {
	return agentContext.run({ prefix }, fn)
}

export function getAgentPrefix(): string {
	const ctx = agentContext.getStore()
	return ctx?.prefix ?? ''
}
