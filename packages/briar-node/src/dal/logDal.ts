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
	errorMessage: string | null
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
	error_message: string | null
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
	requestParams: row.request_params ? JSON.parse(row.request_params) : null,
	errorMessage: row.error_message,
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
		errorMessage?: string
	}): Promise<void> {
		const id = generateId()
		await execute(
			`INSERT INTO request_logs (id, trace_id, method, path, status, duration, ip, user_agent, user_id, request_params, error_message)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
				data.errorMessage || null,
			],
		)
	},

	async findByTraceId(traceId: string): Promise<RequestLogRecord[]> {
		const rows = await query<RequestLogRow>(
			`SELECT id, trace_id, method, path, status, duration, ip, user_agent, user_id, request_params, error_message, created_at
			FROM request_logs
			WHERE trace_id = ?
			ORDER BY created_at DESC`,
			[traceId],
		)
		return rows.map(mapRow)
	},

	async findSlowRequests(limit = 20): Promise<RequestLogRecord[]> {
		const rows = await query<RequestLogRow>(
			`SELECT id, trace_id, method, path, status, duration, ip, user_agent, user_id, request_params, error_message, created_at
			FROM request_logs
			ORDER BY duration DESC
			LIMIT ${Math.floor(limit)}`,
		)
		return rows.map(mapRow)
	},

	async findErrors(limit = 20): Promise<RequestLogRecord[]> {
		const rows = await query<RequestLogRow>(
			`SELECT id, trace_id, method, path, status, duration, ip, user_agent, user_id, request_params, error_message, created_at
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
}
