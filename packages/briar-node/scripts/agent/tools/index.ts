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
