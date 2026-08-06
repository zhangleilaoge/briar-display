import { generateId } from '@briar/shared'
import { execute, query } from '../lib/db'

export type SchedulerRunStatus = 'running' | 'success' | 'failed'
export type SchedulerTriggerType = 'scheduled' | 'manual'

export interface SchedulerRunRecord {
	id: string
	taskName: string
	triggerType: SchedulerTriggerType
	status: SchedulerRunStatus
	message: string | null
	startedAt: Date
	finishedAt: Date | null
}

interface SchedulerRunRow {
	id: string
	task_name: string
	trigger_type: SchedulerTriggerType
	status: SchedulerRunStatus
	message: string | null
	started_at: Date
	finished_at: Date | null
}

const mapRow = (row: SchedulerRunRow): SchedulerRunRecord => ({
	id: row.id,
	taskName: row.task_name,
	triggerType: row.trigger_type,
	status: row.status,
	message: row.message,
	startedAt: row.started_at,
	finishedAt: row.finished_at,
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

	async finish(id: string, status: SchedulerRunStatus, message?: string): Promise<void> {
		await execute(
			'UPDATE scheduler_runs SET status = ?, message = ?, finished_at = NOW() WHERE id = ?',
			[status, message ?? null, id],
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
}
