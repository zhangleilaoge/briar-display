import type { RunRecord, RunRecordStatus } from '@briar/shared'
import { execute, query } from '../lib/db'
import { toRunRecord } from '../lib/runHistory'
import type { DeployHistoryItem } from '../services/deploymentService'

interface DeployRunRow {
	run_id: string
	commit_sha: string
	ref: string
	actor: string
	status: string
	msg: string | null
	deployed_at: Date | null
	started_at: Date | null
	finished_at: Date | null
}

/** GitHub 状态 → 通用状态 */
export const normalizeDeployStatus = (status: string): RunRecordStatus => {
	const s = status.toLowerCase()
	if (s === 'success') return 'success'
	if (
		['failure', 'failed', 'cancelled', 'timed_out', 'startup_failure', 'action_required'].includes(
			s,
		)
	)
		return 'failed'
	if (s === 'skipped' || s === 'neutral') return 'skipped'
	return 'running'
}

/** 通用筛选状态 → 原始状态集合 */
const STATUS_FILTER: Record<RunRecordStatus, string> = {
	success: "status = 'success'",
	failed:
		"status IN ('failure','failed','cancelled','timed_out','startup_failure','action_required')",
	skipped: "status IN ('skipped','neutral')",
	running:
		"status NOT IN ('success','failure','failed','cancelled','timed_out','startup_failure','action_required','skipped','neutral')",
}

const toDate = (at: string | undefined): Date | null => {
	if (!at) return null
	const d = new Date(at)
	return Number.isNaN(d.getTime()) ? null : d
}

export const deployRunDal = {
	/** 幂等 upsert（按 run_id），状态/提交信息以最新为准 */
	async upsertMany(items: DeployHistoryItem[]): Promise<void> {
		for (const item of items) {
			if (!item.run) continue
			await execute(
				`INSERT INTO deploy_runs (run_id, commit_sha, ref, actor, status, msg, deployed_at, started_at, finished_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE status = VALUES(status), msg = COALESCE(VALUES(msg), msg),
           commit_sha = VALUES(commit_sha), ref = VALUES(ref), actor = VALUES(actor),
           deployed_at = COALESCE(VALUES(deployed_at), deployed_at),
           started_at = COALESCE(VALUES(started_at), started_at),
           finished_at = COALESCE(VALUES(finished_at), finished_at)`,
				[
					String(item.run).slice(0, 32),
					item.commit ?? '',
					item.ref ?? '',
					item.actor ?? '',
					item.status ?? '',
					item.msg ?? null,
					toDate(item.at),
					toDate(item.startedAt),
					toDate(item.finishedAt),
				],
			)
		}
	},

	async listPaged(opts: {
		limit: number
		offset: number
		status?: RunRecordStatus
	}): Promise<{ items: RunRecord[]; total: number }> {
		const where = opts.status ? `WHERE ${STATUS_FILTER[opts.status]}` : ''
		const [rows, countRows] = await Promise.all([
			query<DeployRunRow>(
				`SELECT * FROM deploy_runs ${where} ORDER BY deployed_at DESC LIMIT ? OFFSET ?`,
				[opts.limit, opts.offset],
			),
			query<{ total: number }>(`SELECT COUNT(*) AS total FROM deploy_runs ${where}`),
		])
		return {
			items: rows.map((row) =>
				toRunRecord({
					id: row.run_id,
					trigger: 'push',
					status: normalizeDeployStatus(row.status),
					message: row.msg,
					startedAt: row.started_at ?? row.deployed_at ?? new Date(0),
					finishedAt: row.started_at ? row.finished_at : null,
					detail: {
						runId: row.run_id,
						commit: row.commit_sha,
						ref: row.ref,
						actor: row.actor,
						rawStatus: row.status,
					},
				}),
			),
			total: Number(countRows[0]?.total ?? 0),
		}
	},

	/** 已结束但缺起止时间的记录（待回填耗时） */
	async listMissingDuration(limit: number): Promise<string[]> {
		const rows = await query<{ run_id: string }>(
			`SELECT run_id FROM deploy_runs
       WHERE (started_at IS NULL OR finished_at IS NULL)
         AND status IN ('success','failure','failed','cancelled','timed_out','startup_failure','action_required','skipped','neutral','completed')
       ORDER BY deployed_at DESC LIMIT ?`,
			[limit],
		)
		return rows.map((r) => r.run_id)
	},

	async recentStatuses(limit: number): Promise<RunRecordStatus[]> {
		const rows = await query<{ status: string }>(
			'SELECT status FROM deploy_runs ORDER BY deployed_at DESC LIMIT ?',
			[limit],
		)
		return rows.map((r) => normalizeDeployStatus(r.status))
	},
}
