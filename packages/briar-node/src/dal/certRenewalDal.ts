import { randomUUID } from 'crypto'
import type { RunRecord, RunRecordStatus } from '@briar/shared'
import { execute, query } from '../lib/db'
import { RUN_HISTORY_RETENTION_DAYS, RUN_STATS_WINDOW, toRunRecord } from '../lib/runHistory'

export type CertRenewalTrigger = 'scheduled' | 'manual'
export type CertRenewalStatus = 'running' | 'success' | 'skipped' | 'failed'

export interface CertRenewalLogRow {
	id: string
	domain: string
	trigger_type: CertRenewalTrigger
	status: CertRenewalStatus
	message: string | null
	started_at: Date
	finished_at: Date | null
}

export interface CertRenewalLog {
	id: string
	domain: string
	triggerType: CertRenewalTrigger
	status: CertRenewalStatus
	message: string | null
	startedAt: string
	finishedAt: string | null
}

const mapRow = (row: CertRenewalLogRow): CertRenewalLog => ({
	id: row.id,
	domain: row.domain,
	triggerType: row.trigger_type,
	status: row.status,
	message: row.message,
	startedAt: row.started_at instanceof Date ? row.started_at.toISOString() : String(row.started_at),
	finishedAt: row.finished_at
		? row.finished_at instanceof Date
			? row.finished_at.toISOString()
			: String(row.finished_at)
		: null,
})

export const certRenewalDal = {
	/** 创建一条 running 状态的续期记录，返回记录 id */
	async create(domain: string, triggerType: CertRenewalTrigger): Promise<string> {
		const id = randomUUID()
		void this.prune().catch(() => {})
		await execute('INSERT INTO cert_renewal_logs (id, domain, trigger_type) VALUES (?, ?, ?)', [
			id,
			domain,
			triggerType,
		])
		return id
	},

	/** 结束一条续期记录 */
	async finish(id: string, status: Exclude<CertRenewalStatus, 'running'>, message?: string) {
		await execute(
			'UPDATE cert_renewal_logs SET status = ?, message = ?, finished_at = NOW() WHERE id = ?',
			[status, message ?? null, id],
		)
	},

	/** 最近的续期记录（倒序） */
	async list(limit = 20): Promise<CertRenewalLog[]> {
		const rows = await query<CertRenewalLogRow>(
			'SELECT * FROM cert_renewal_logs ORDER BY started_at DESC LIMIT ?',
			[limit],
		)
		return rows.map(mapRow)
	},

	/** 续期历史（分页 + 状态筛选，通用 RunRecord 格式） */
	async listPaged(opts: {
		limit: number
		offset: number
		status?: RunRecordStatus
	}): Promise<{ items: RunRecord[]; total: number }> {
		const where = opts.status ? 'WHERE status = ?' : ''
		const values: unknown[] = opts.status ? [opts.status] : []
		const [rows, countRows] = await Promise.all([
			query<CertRenewalLogRow>(
				`SELECT * FROM cert_renewal_logs ${where} ORDER BY started_at DESC LIMIT ? OFFSET ?`,
				[...values, opts.limit, opts.offset],
			),
			query<{ total: number }>(`SELECT COUNT(*) AS total FROM cert_renewal_logs ${where}`, values),
		])
		return {
			items: rows.map((row) =>
				toRunRecord({
					id: row.id,
					trigger: row.trigger_type,
					status: row.status,
					message: row.message,
					startedAt: row.started_at,
					finishedAt: row.finished_at,
					detail: { domain: row.domain },
				}),
			),
			total: Number(countRows[0]?.total ?? 0),
		}
	},

	async recentStatuses(limit = RUN_STATS_WINDOW): Promise<RunRecordStatus[]> {
		const rows = await query<{ status: RunRecordStatus }>(
			'SELECT status FROM cert_renewal_logs ORDER BY started_at DESC LIMIT ?',
			[limit],
		)
		return rows.map((r) => r.status)
	},

	/** 保留期清理 */
	async prune(daysToKeep = RUN_HISTORY_RETENTION_DAYS): Promise<number> {
		const result = await execute(
			'DELETE FROM cert_renewal_logs WHERE started_at < DATE_SUB(NOW(), INTERVAL ? DAY)',
			[daysToKeep],
		)
		return result.affectedRows
	},
}
