import { handleChat } from './chat.js'
import { handleSession, handleSessionDel } from './session.js'
import { handleSub, handleSubChat, handleSubList, handleSubView } from './sub-agent.js'
import { handleClear, handleExit, handleHelp, handleNew } from './system.js'
import type { CommandContext } from './types.js'

export type { CommandContext } from './types.js'

export async function handleCommand(trimmed: string, ctx: CommandContext): Promise<boolean> {
	// 精确匹配优先
	if (trimmed === '/exit' || trimmed === '/quit') return handleExit(trimmed, ctx)
	if (trimmed === '/clear') return handleClear(trimmed, ctx)
	if (trimmed === '/new') return handleNew(trimmed, ctx)
	if (trimmed === '/help') return handleHelp(trimmed, ctx)
	if (trimmed === '/session') return handleSession(trimmed, ctx)
	if (trimmed === '/sub-list') return handleSubList(trimmed, ctx)

	// 前缀匹配（注意顺序：长的在前）
	if (trimmed.startsWith('/session del')) return handleSessionDel(trimmed, ctx)
	if (trimmed.startsWith('/subChat')) return handleSubChat(trimmed, ctx)
	if (trimmed.startsWith('/sub-view')) return handleSubView(trimmed, ctx)
	if (trimmed === '/sub' || trimmed.startsWith('/sub ')) return handleSub(trimmed, ctx)

	// 普通聊天
	return handleChat(trimmed, ctx)
}
