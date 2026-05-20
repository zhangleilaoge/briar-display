import { sendChatMessage } from '../chat.js'
import type { CommandContext } from './types.js'

export async function handleChat(trimmed: string, ctx: CommandContext): Promise<boolean> {
	ctx.appState.setMessages((prev) => [...prev, { role: 'user', content: trimmed }])
	ctx.appState.setIsLoading(true)

	const abortController = new AbortController()
	ctx.appState.abortCtrlRef.current = abortController

	try {
		const onStreamUpdate = (content: string) => {
			ctx.appState.setMessages((prev) => {
				const next = [...prev]
				const last = next[next.length - 1]
				if (last && last.role === 'assistant') {
					next[next.length - 1] = { ...last, content }
				} else {
					next.push({ role: 'assistant', content })
				}
				return next
			})
		}

		const result = await sendChatMessage({
			kimi: ctx.kimi,
			useCli: ctx.useCli,
			streamMode: ctx.streamMode,
			messages: ctx.appState.messages,
			prompt: trimmed,
			abortSignal: abortController.signal,
			onStreamUpdate,
		})

		if (!ctx.streamMode) {
			ctx.appState.setMessages((prev) => {
				const next = [...prev]
				const last = next[next.length - 1]
				if (last && last.role === 'assistant') {
					next[next.length - 1] = { ...last, content: result }
				} else {
					next.push({ role: 'assistant', content: result })
				}
				return next
			})
		}
	} catch (error) {
		ctx.appState.setMessages((prev) => [
			...prev,
			{
				role: 'assistant',
				content: `Error: ${error instanceof Error ? error.message : String(error)}`,
			},
		])
	} finally {
		ctx.appState.setIsLoading(false)
		ctx.appState.abortCtrlRef.current = null
	}

	return true
}
