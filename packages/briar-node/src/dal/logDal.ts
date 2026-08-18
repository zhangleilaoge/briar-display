import { generateId } from '@briar/shared'
import { execute, query } from '../lib/db'

export interface RequestLogRecord {
	id: string
	traceId: string
	method: string
	path: string
	status: number
	duration: number
	ip: string | null
	userAgent: string | null
	userId: string | null
	requestParams: Record<string, unknown> | null
	responseBody: string | null
	errorMessage: string | null
	errorStack: string | null
	createdAt: Date
}

interface RequestLogRow {
	id: string
	trace_id: string
	method: string
	path: string
	status: number
	duration: number
	ip: string | null
	user_agent: string | null
	user_id: string | null
	request_params: string | null
	response_body: string | null
	error_message: string | null
	error_stack: string | null
	created_at: Date
}

const mapRow = (row: RequestLogRow): RequestLogRecord => ({
	id: row.id,
	traceId: row.trace_id,
	method: row.method,
	path: row.path,
	status: row.status,
	duration: row.duration,
	ip: row.ip,
	userAgent: row.user_agent,
	userId: row.user_id,
	requestParams: row.request_params
		? typeof row.request_params === 'string'
			? JSON.parse(row.request_params)
			: row.request_params
		: null,
	errorMessage: row.error_message,
	errorStack: row.error_stack,
	responseBody: row.response_body,
	createdAt: row.created_at,
})

export const logDal = {
	async create(data: {
		traceId: string
		method: string
		path: string
		status: number
		duration: number
		ip?: string
		userAgent?: string
		userId?: string
		requestParams?: Record<string, unknown>
		responseBody?: string
		errorMessage?: string
		errorStack?: string
	}): Promise<void> {
		const id = generateId()
		await execute(
			`INSERT INTO request_logs (id, trace_id, method, path, status, duration, ip, user_agent, user_id, request_params, response_body, error_message, error_stack)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				id,
				data.traceId,
				data.method,
				data.path,
				data.status,
				data.duration,
				data.ip || null,
				data.userAgent || null,
				data.userId || null,
				data.requestParams ? JSON.stringify(data.requestParams) : null,
				data.responseBody || null,
				data.errorMessage || null,
				data.errorStack || null,
			],
		)
	},

	async findByTraceId(traceId: string): Promise<RequestLogRecord[]> {
		const rows = await query<RequestLogRow>(
			`SELECT id, trace_id, method, path, status, duration, ip, user_agent, user_id, request_params, response_body, error_message, error_stack, created_at
			FROM request_logs
			WHERE trace_id = ?
			ORDER BY created_at DESC`,
			[traceId],
		)
		return rows.map(mapRow)
	},

	async findSlowRequests(limit = 20): Promise<RequestLogRecord[]> {
		const rows = await query<RequestLogRow>(
			`SELECT id, trace_id, method, path, status, duration, ip, user_agent, user_id, request_params, response_body, error_message, error_stack, created_at
			FROM request_logs
			ORDER BY duration DESC
			LIMIT ${Math.floor(limit)}`,
		)
		return rows.map(mapRow)
	},

	async findErrors(limit = 20): Promise<RequestLogRecord[]> {
		const rows = await query<RequestLogRow>(
			`SELECT id, trace_id, method, path, status, duration, ip, user_agent, user_id, request_params, response_body, error_message, error_stack, created_at
			FROM request_logs
			WHERE status >= 400
			ORDER BY created_at DESC
			LIMIT ${Math.floor(limit)}`,
		)
		return rows.map(mapRow)
	},

	async cleanup(daysToKeep = 7): Promise<number> {
		const result = await execute(
			'DELETE FROM request_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)',
			[daysToKeep],
		)
		return result.affectedRows
	},

	async list(
		filters: {
			method?: string
			path?: string
			statusMin?: number
			statusMax?: number
			traceId?: string
			userId?: string
			keyword?: string
			startTime?: string
			endTime?: string
			limit?: number
			offset?: number
		} = {},
	): Promise<{ items: RequestLogRecord[]; total: number }> {
		const conditions: string[] = []
		const values: unknown[] = []

		if (filters.method) {
			conditions.push('method = ?')
			values.push(filters.method)
		}
		if (filters.path) {
			conditions.push('path LIKE ?')
			values.push(`%${filters.path}%`)
		}
		if (filters.statusMin !== undefined) {
			conditions.push('status >= ?')
			values.push(filters.statusMin)
		}
		if (filters.statusMax !== undefined) {
			conditions.push('status <= ?')
			values.push(filters.statusMax)
		}
		if (filters.traceId) {
			conditions.push('trace_id = ?')
			values.push(filters.traceId)
		}
		if (filters.userId) {
			conditions.push('user_id LIKE ?')
			values.push(`%${filters.userId}%`)
		}
		if (filters.keyword) {
			conditions.push(
				'(path LIKE ? OR error_message LIKE ? OR request_params LIKE ? OR response_body LIKE ? OR trace_id LIKE ?)',
			)
			const kw = `%${filters.keyword}%`
			values.push(kw, kw, kw, kw, kw)
		}
		if (filters.startTime) {
			conditions.push('created_at >= ?')
			values.push(filters.startTime)
		}
		if (filters.endTime) {
			conditions.push('created_at <= ?')
			values.push(filters.endTime)
		}

		const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
		const limit = Math.min(filters.limit || 50, 200)
		const offset = Math.max(filters.offset || 0, 0)

		const countRow = await query<{ cnt: number }>(
			`SELECT COUNT(*) as cnt FROM request_logs ${where}`,
			values,
		)
		const total = countRow[0]?.cnt || 0

		const rows = await query<RequestLogRow>(
			`SELECT id, trace_id, method, path, status, duration, ip, user_agent, user_id, request_params, response_body, error_message, error_stack, created_at
			FROM request_logs ${where}
			ORDER BY created_at DESC
			LIMIT ${limit} OFFSET ${offset}`,
			values,
		)

		return { items: rows.map(mapRow), total }
	},

	async getStats(): Promise<{
		todayTotal: number
		todayErrors: number
		avgDuration: number
		slowCount: number
	}> {
		const rows = await query<{
			today_total: number
			today_errors: number
			avg_duration: number | null
			slow_count: number
		}>(
			`SELECT
				COUNT(*) as today_total,
				SUM(CASE WHEN status >= 400 THEN 1 ELSE 0 END) as today_errors,
				AVG(duration) as avg_duration,
				SUM(CASE WHEN duration > 1000 THEN 1 ELSE 0 END) as slow_count
			FROM request_logs
			WHERE created_at >= CURDATE()`,
		)
		const row = rows[0]
		return {
			todayTotal: row?.today_total || 0,
			todayErrors: row?.today_errors || 0,
			avgDuration: Math.round(row?.avg_duration || 0),
			slowCount: row?.slow_count || 0,
		}
	},
}
