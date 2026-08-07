import { generateId } from '@briar/shared'
import { execute } from '../lib/db'

export type TerminalAuditEvent = 'connect' | 'input' | 'close'

export const terminalAuditDal = {
	/** 写审计日志（fire-and-forget，失败仅打日志） */
	async log(entry: {
		sessionId: string
		userId: string
		userName: string
		event: TerminalAuditEvent
		data?: string
	}): Promise<void> {
		try {
			await execute(
				'INSERT INTO terminal_audit_logs (id, session_id, user_id, user_name, event, data) VALUES (?, ?, ?, ?, ?, ?)',
				[
					generateId(),
					entry.sessionId,
					entry.userId,
					entry.userName,
					entry.event,
					entry.data ?? null,
				],
			)
		} catch (err) {
			console.error('[Terminal] 审计日志写入失败:', err)
		}
	},
}
