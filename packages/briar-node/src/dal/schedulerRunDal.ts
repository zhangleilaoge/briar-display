import { type RunRecord, type RunRecordStatus, generateId } from '@briar/shared'
import { execute, query } from '../lib/db'
import { RUN_STATS_WINDOW, parseDetail, toRunRecord } from '../lib/runHistory'

export type SchedulerRunStatus = 'running' | 'success' | 'skipped' | 'failed'
export type SchedulerTriggerType = 'scheduled' | 'manual'

export interface SchedulerRunRecord {
	id: string
	taskName: string
	triggerType: SchedulerTriggerType
	status: SchedulerRunStatus
	message: string | null
	detail: Record<string, unknown> | null
	startedAt: Date
	finishedAt: Date | null
}

interface SchedulerRunRow {
	id: string
	task_name: string
	trigger_type: SchedulerTriggerType
	status: SchedulerRunStatus
	message: string | null
	detail: unknown
	started_at: Date
	finished_at: Date | null
}

const mapRow = (row: SchedulerRunRow): SchedulerRunRecord => ({
	id: row.id,
	taskName: row.task_name,
	triggerType: row.trigger_type,
	status: row.status,
	message: row.message,
	detail: parseDetail(row.detail),
	startedAt: row.started_at,
	finishedAt: row.finished_at,
})

const toGeneric = (row: SchedulerRunRow): RunRecord =>
	toRunRecord({
		id: row.id,
		trigger: row.trigger_type,
		status: row.status,
		message: row.message,
		startedAt: row.started_at,
		finishedAt: row.finished_at,
		detail: row.detail,
	})

export const schedulerRunDal = {
	async create(taskName: string, triggerType: SchedulerTriggerType): Promise<string> {
		const id = generateId()
		await execute('INSERT INTO scheduler_runs (id, task_name, trigger_type) VALUES (?, ?, ?)', [
			id,
			taskName,
			triggerType,
		])
		return id
	},

	async finish(
		id: string,
		status: SchedulerRunStatus,
		message?: string,
		detail?: Record<string, unknown> | null,
	): Promise<void> {
		await execute(
			'UPDATE scheduler_runs SET status = ?, message = ?, detail = ?, finished_at = NOW() WHERE id = ?',
			[status, message ?? null, detail ? JSON.stringify(detail) : null, id],
		)
	},

	/** 每个任务的最近一次运行 */
	async latestByTask(): Promise<Map<string, SchedulerRunRecord>> {
		const rows = await query<SchedulerRunRow>(
			`SELECT r.* FROM scheduler_runs r
       INNER JOIN (
         SELECT task_name, MAX(started_at) AS max_started FROM scheduler_runs GROUP BY task_name
       ) latest ON r.task_name = latest.task_name AND r.started_at = latest.max_started`,
		)
		const map = new Map<string, SchedulerRunRecord>()
		for (const row of rows) {
			map.set(row.task_name, mapRow(row))
		}
		return map
	},

	/** 某任务的运行历史（分页 + 状态筛选，倒序） */
	async listByTask(
		taskName: string,
		opts: { limit: number; offset: number; status?: RunRecordStatus },
	): Promise<{ items: RunRecord[]; total: number }> {
		const where = opts.status ? 'task_name = ? AND status = ?' : 'task_name = ?'
		const values: unknown[] = opts.status ? [taskName, opts.status] : [taskName]
		const [rows, countRows] = await Promise.all([
			query<SchedulerRunRow>(
				`SELECT * FROM scheduler_runs WHERE ${where} ORDER BY started_at DESC LIMIT ? OFFSET ?`,
				[...values, opts.limit, opts.offset],
			),
			query<{ total: number }>(
				`SELECT COUNT(*) AS total FROM scheduler_runs WHERE ${where}`,
				values,
			),
		])
		return { items: rows.map(toGeneric), total: Number(countRows[0]?.total ?? 0) }
	},

	/** 某任务最近 N 次状态（新→旧） */
	async recentStatuses(taskName: string, limit = RUN_STATS_WINDOW): Promise<RunRecordStatus[]> {
		const rows = await query<{ status: RunRecordStatus }>(
			'SELECT status FROM scheduler_runs WHERE task_name = ? ORDER BY started_at DESC LIMIT ?',
			[taskName, limit],
		)
		return rows.map((r) => r.status)
	},

	/** 保留期清理：删除 N 天前的记录 */
	async prune(daysToKeep: number): Promise<number> {
		const result = await execute(
			'DELETE FROM scheduler_runs WHERE started_at < DATE_SUB(NOW(), INTERVAL ? DAY)',
			[daysToKeep],
		)
		return result.affectedRows
	},
}
