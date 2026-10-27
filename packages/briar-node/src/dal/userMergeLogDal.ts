import { generateId } from '@briar/shared'
import { execute, query, queryOne } from '../lib/db'

export type MergeLogStatus = 'success' | 'failed'

export interface MergeLogModule {
	name: string
	label: string
	moved: number
	notes: string[]
}

export interface MergeLogConflict {
	module: string
	label: string
	message: string
}

export interface UserMergeLogRecord {
	id: string
	operatorId: string
	operatorName: string
	sourceUserId: string
	sourceName: string
	sourceEmail: string
	targetUserId: string
	targetName: string
	targetEmail: string
	modules: MergeLogModule[]
	conflicts: MergeLogConflict[]
	status: MergeLogStatus
	error: string | null
	startedAt: Date
	finishedAt: Date
}

interface Row {
	id: string
	operator_id: string
	operator_name: string
	source_user_id: string
	source_name: string
	source_email: string
	target_user_id: string
	target_name: string
	target_email: string
	modules: unknown
	conflicts: unknown
	status: MergeLogStatus
	error: string | null
	started_at: Date
	finished_at: Date
}

const parseJson = <T>(v: unknown): T[] => {
	if (Array.isArray(v)) return v as T[]
	if (typeof v === 'string' && v) {
		try {
			const parsed = JSON.parse(v)
			return Array.isArray(parsed) ? parsed : []
		} catch {
			return []
		}
	}
	return []
}

const mapRow = (r: Row): UserMergeLogRecord => ({
	id: r.id,
	operatorId: r.operator_id,
	operatorName: r.operator_name,
	sourceUserId: r.source_user_id,
	sourceName: r.source_name,
	sourceEmail: r.source_email,
	targetUserId: r.target_user_id,
	targetName: r.target_name,
	targetEmail: r.target_email,
	modules: parseJson<MergeLogModule>(r.modules),
	conflicts: parseJson<MergeLogConflict>(r.conflicts),
	status: r.status,
	error: r.error,
	startedAt: r.started_at,
	finishedAt: r.finished_at,
})

export interface UserSnapshot {
	id: string
	name: string
	email: string
}

export const userMergeLogDal = {
	async create(data: {
		operator: UserSnapshot
		source: UserSnapshot
		target: UserSnapshot
		modules: MergeLogModule[]
		conflicts: MergeLogConflict[]
		status: MergeLogStatus
		error?: string | null
		startedAt: Date
		finishedAt: Date
	}): Promise<string> {
		const id = generateId()
		await execute(
			`INSERT INTO user_merge_logs (id, operator_id, operator_name, source_user_id, source_name, source_email,
			 target_user_id, target_name, target_email, modules, conflicts, status, error, started_at, finished_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				id,
				data.operator.id,
				data.operator.name,
				data.source.id,
				data.source.name,
				data.source.email,
				data.target.id,
				data.target.name,
				data.target.email,
				JSON.stringify(data.modules),
				JSON.stringify(data.conflicts),
				data.status,
				data.error ? data.error.slice(0, 4000) : null,
				data.startedAt,
				data.finishedAt,
			],
		)
		return id
	},

	async list(opts: { limit: number; offset: number; status?: MergeLogStatus; userId?: string }) {
		const where: string[] = []
		const params: (string | number)[] = []
		if (opts.status) {
			where.push('status = ?')
			params.push(opts.status)
		}
		if (opts.userId) {
			where.push('(target_user_id = ? OR source_user_id = ?)')
			params.push(opts.userId, opts.userId)
		}
		const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
		const rows = await query<Row>(
			`SELECT * FROM user_merge_logs ${whereSql} ORDER BY started_at DESC LIMIT ? OFFSET ?`,
			[...params, opts.limit, opts.offset],
		)
		const total = await queryOne<{ n: number }>(
			`SELECT COUNT(*) AS n FROM user_merge_logs ${whereSql}`,
			params,
		)
		return { items: rows.map(mapRow), total: Number(total?.n ?? 0) }
	},
}
