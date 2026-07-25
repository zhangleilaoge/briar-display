import type { ApiResponse } from '@briar/shared'
import { HTTP_STATUS, generateId } from '@briar/shared'
import { Hono } from 'hono'
import type mysql from 'mysql2/promise'
import { DatabaseConfig } from '../config/database'
import { getPool } from '../lib/db'

const sqlConsoleRoutes = new Hono()

// ==================== 安全配置 ====================

const MAX_SQL_LENGTH = 10000
const MAX_RESULT_ROWS = 1000
const QUERY_TIMEOUT_MS = 10000
const RATE_LIMIT_PER_MINUTE = 30

/** 永远禁止的 SQL 模式（不区分大小写） */
const BLOCKED_PATTERNS: { pattern: RegExp; reason: string }[] = [
	{ pattern: /\bDROP\s+DATABASE\b/i, reason: '禁止删除数据库' },
	{ pattern: /\bDROP\s+TABLE\b/i, reason: '禁止删除表（请使用 migrate.sql）' },
	{ pattern: /\bTRUNCATE\s+TABLE\b/i, reason: '禁止清空表' },
	{ pattern: /\bALTER\s+USER\b/i, reason: '禁止修改用户' },
	{ pattern: /\bGRANT\b/i, reason: '禁止权限操作' },
	{ pattern: /\bREVOKE\b/i, reason: '禁止权限操作' },
	{ pattern: /\bINTO\s+OUTFILE\b/i, reason: '禁止文件写入' },
	{ pattern: /\bINTO\s+DUMPFILE\b/i, reason: '禁止文件写入' },
	{ pattern: /\bLOAD_FILE\s*\(/i, reason: '禁止文件读取' },
	{ pattern: /\bSET\s+GLOBAL\b/i, reason: '禁止修改全局变量' },
	{ pattern: /\bSET\s+@@global\b/i, reason: '禁止修改全局变量' },
	{ pattern: /\bKILL\b/i, reason: '禁止终止连接' },
	{ pattern: /\bUSE\s+\w+/i, reason: '禁止切换数据库' },
	{ pattern: /\bSHUTDOWN\b/i, reason: '禁止关闭服务' },
	{ pattern: /\bCREATE\s+USER\b/i, reason: '禁止创建用户' },
	{ pattern: /\bRENAME\s+TABLE\b/i, reason: '禁止重命名表' },
	{ pattern: /\bLOCK\s+TABLES?\b/i, reason: '禁止锁表' },
]

/** 无 WHERE 的写操作检测 */
const UNSAFE_WRITE_PATTERN = /\b(UPDATE|DELETE)\b(?![\s\S]*\bWHERE\b)/i

type SqlType = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'DDL' | 'OTHER'

function classifySql(sql: string): SqlType {
	const trimmed = sql.trim().toUpperCase()
	if (
		trimmed.startsWith('SELECT') ||
		trimmed.startsWith('SHOW') ||
		trimmed.startsWith('DESCRIBE') ||
		trimmed.startsWith('EXPLAIN')
	)
		return 'SELECT'
	if (trimmed.startsWith('INSERT')) return 'INSERT'
	if (trimmed.startsWith('UPDATE')) return 'UPDATE'
	if (trimmed.startsWith('DELETE')) return 'DELETE'
	if (trimmed.startsWith('CREATE') || trimmed.startsWith('ALTER') || trimmed.startsWith('DROP'))
		return 'DDL'
	return 'OTHER'
}

function isReadOnly(sql: string): boolean {
	const type = classifySql(sql)
	return type === 'SELECT'
}

function validateSql(sql: string): { valid: boolean; reason?: string } {
	if (sql.length > MAX_SQL_LENGTH) {
		return { valid: false, reason: `SQL 长度超过限制（最大 ${MAX_SQL_LENGTH} 字符）` }
	}

	for (const { pattern, reason } of BLOCKED_PATTERNS) {
		if (pattern.test(sql)) {
			return { valid: false, reason }
		}
	}

	if (UNSAFE_WRITE_PATTERN.test(sql)) {
		return { valid: false, reason: 'UPDATE/DELETE 语句必须包含 WHERE 条件' }
	}

	return { valid: true }
}

// ==================== 频率限制 ====================

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(userId: string): boolean {
	const now = Date.now()
	const entry = rateLimitMap.get(userId)

	if (!entry || now > entry.resetAt) {
		rateLimitMap.set(userId, { count: 1, resetAt: now + 60000 })
		return true
	}

	if (entry.count >= RATE_LIMIT_PER_MINUTE) {
		return false
	}

	entry.count++
	return true
}

// ==================== 审计日志 ====================

async function logAudit(data: {
	userId: string
	sql: string
	sqlType: SqlType
	status: 'success' | 'error' | 'timeout' | 'blocked'
	affectedRows?: number
	rowCount?: number
	durationMs?: number
	errorMessage?: string
	ip?: string
}) {
	try {
		const pool = getPool()
		await pool.execute(
			`INSERT INTO sql_audit_logs (id, user_id, sql_text, sql_type, status, affected_rows, row_count, duration_ms, error_message, ip)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				generateId(),
				data.userId,
				data.sql.slice(0, 5000),
				data.sqlType,
				data.status,
				data.affectedRows ?? null,
				data.rowCount ?? null,
				data.durationMs ?? null,
				data.errorMessage ?? null,
				data.ip ?? null,
			],
		)
	} catch (err) {
		console.error('[SQL Console] 审计日志写入失败:', err)
	}
}

// ==================== 路由 ====================

/** POST /execute — 执行 SQL */
sqlConsoleRoutes.post('/execute', async (c) => {
	const user = (c as any).get('user') as { id: string } | undefined
	if (!user) {
		return c.json<ApiResponse>({ success: false, message: '请先登录' }, HTTP_STATUS.UNAUTHORIZED)
	}

	const body = await c.req.json<{ sql: string; readOnly?: boolean }>()
	const sql = (body.sql || '').trim()

	if (!sql) {
		return c.json<ApiResponse>(
			{ success: false, message: '请输入 SQL 语句' },
			HTTP_STATUS.BAD_REQUEST,
		)
	}

	// 频率限制
	if (!checkRateLimit(user.id)) {
		return c.json<ApiResponse>(
			{ success: false, message: `操作过于频繁，每分钟最多执行 ${RATE_LIMIT_PER_MINUTE} 次` },
			HTTP_STATUS.TOO_MANY_REQUESTS,
		)
	}

	const sqlType = classifySql(sql)
	const ip =
		c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || c.req.header('x-real-ip') || ''

	// 只读模式下拒绝写操作
	if (body.readOnly !== false && !isReadOnly(sql)) {
		await logAudit({
			userId: user.id,
			sql,
			sqlType,
			status: 'blocked',
			errorMessage: '只读模式下禁止写操作',
			ip,
		})
		return c.json<ApiResponse>(
			{
				success: false,
				message: '当前为只读模式，仅允许 SELECT 查询。如需执行写操作，请关闭只读模式。',
			},
			HTTP_STATUS.FORBIDDEN,
		)
	}

	// 黑名单校验
	const validation = validateSql(sql)
	if (!validation.valid) {
		await logAudit({
			userId: user.id,
			sql,
			sqlType,
			status: 'blocked',
			errorMessage: validation.reason,
			ip,
		})
		return c.json<ApiResponse>(
			{ success: false, message: validation.reason },
			HTTP_STATUS.FORBIDDEN,
		)
	}

	// 执行 SQL（使用独立连接 + 超时）
	const startTime = Date.now()
	let conn: mysql.PoolConnection | null = null

	try {
		const pool = getPool()
		conn = await pool.getConnection()

		// 设置会话级超时
		await conn.query(`SET SESSION max_execution_time = ${QUERY_TIMEOUT_MS}`)

		const [rows, fields] = await conn.query(sql)
		const durationMs = Date.now() - startTime

		// 判断是查询还是写操作
		if (Array.isArray(rows)) {
			// SELECT 查询
			const allRows = rows as Record<string, any>[]
			const truncated = allRows.length > MAX_RESULT_ROWS
			const resultRows = truncated ? allRows.slice(0, MAX_RESULT_ROWS) : allRows

			// 提取列信息
			const columns =
				fields && Array.isArray(fields)
					? (fields as any[]).map((f: any) => ({ name: f.name, type: f.type }))
					: resultRows.length > 0
						? Object.keys(resultRows[0]).map((name) => ({ name, type: 253 }))
						: []

			await logAudit({
				userId: user.id,
				sql,
				sqlType,
				status: 'success',
				rowCount: allRows.length,
				durationMs,
				ip,
			})

			return c.json<ApiResponse>({
				success: true,
				data: {
					type: 'query',
					columns,
					rows: resultRows,
					totalRows: allRows.length,
					truncated,
					durationMs,
				},
			})
		}

		// 写操作（INSERT/UPDATE/DELETE/DDL）
		const header = rows as mysql.ResultSetHeader
		await logAudit({
			userId: user.id,
			sql,
			sqlType,
			status: 'success',
			affectedRows: header.affectedRows,
			durationMs,
			ip,
		})

		return c.json<ApiResponse>({
			success: true,
			data: {
				type: 'execute',
				affectedRows: header.affectedRows,
				insertId: header.insertId || null,
				durationMs,
			},
		})
	} catch (err: any) {
		const durationMs = Date.now() - startTime
		const isTimeout = err.code === 'ER_QUERY_TIMEOUT' || err.message?.includes('max_execution_time')
		const status = isTimeout ? 'timeout' : 'error'
		const errorMessage = isTimeout
			? `查询超时（>${QUERY_TIMEOUT_MS / 1000}s）`
			: err.message || '执行失败'

		await logAudit({ userId: user.id, sql, sqlType, status, durationMs, errorMessage, ip })

		return c.json<ApiResponse>({ success: false, message: errorMessage }, HTTP_STATUS.BAD_REQUEST)
	} finally {
		conn?.release()
	}
})

/** GET /schema — 获取数据库表结构 */
sqlConsoleRoutes.get('/schema', async (c) => {
	const user = (c as any).get('user') as { id: string } | undefined
	if (!user) {
		return c.json<ApiResponse>({ success: false, message: '请先登录' }, HTTP_STATUS.UNAUTHORIZED)
	}

	try {
		const pool = getPool()

		// 获取所有表
		const [tables] = await pool.query(
			`SELECT TABLE_NAME, TABLE_COMMENT, TABLE_ROWS, DATA_LENGTH
			 FROM information_schema.TABLES
			 WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
			 ORDER BY TABLE_NAME`,
			[DatabaseConfig.database],
		)

		// 获取所有列
		const [columns] = await pool.query(
			`SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY, COLUMN_COMMENT, COLUMN_DEFAULT
			 FROM information_schema.COLUMNS
			 WHERE TABLE_SCHEMA = ?
			 ORDER BY TABLE_NAME, ORDINAL_POSITION`,
			[DatabaseConfig.database],
		)

		// 按表分组列
		const tableMap = new Map<string, any[]>()
		for (const col of columns as any[]) {
			const tableName = col.TABLE_NAME
			if (!tableMap.has(tableName)) tableMap.set(tableName, [])
			tableMap.get(tableName)!.push({
				name: col.COLUMN_NAME,
				type: col.COLUMN_TYPE,
				nullable: col.IS_NULLABLE === 'YES',
				key: col.COLUMN_KEY || null,
				comment: col.COLUMN_COMMENT || null,
				default: col.COLUMN_DEFAULT,
			})
		}

		const schema = (tables as any[]).map((t) => ({
			name: t.TABLE_NAME,
			comment: t.TABLE_COMMENT || null,
			rowCount: t.TABLE_ROWS ?? 0,
			dataSize: t.DATA_LENGTH ?? 0,
			columns: tableMap.get(t.TABLE_NAME) || [],
		}))

		return c.json<ApiResponse>({
			success: true,
			data: {
				database: DatabaseConfig.database,
				tables: schema,
			},
		})
	} catch (err: any) {
		return c.json<ApiResponse>(
			{ success: false, message: err.message || '获取表结构失败' },
			HTTP_STATUS.INTERNAL_SERVER_ERROR,
		)
	}
})

/** GET /history — 获取执行历史 */
sqlConsoleRoutes.get('/history', async (c) => {
	const user = (c as any).get('user') as { id: string } | undefined
	if (!user) {
		return c.json<ApiResponse>({ success: false, message: '请先登录' }, HTTP_STATUS.UNAUTHORIZED)
	}

	const page = Math.max(1, Number(c.req.query('page')) || 1)
	const pageSize = Math.min(50, Math.max(1, Number(c.req.query('pageSize')) || 20))

	try {
		const pool = getPool()
		const offset = (page - 1) * pageSize

		const [countResult] = await pool.query('SELECT COUNT(*) AS cnt FROM sql_audit_logs')
		const total = (countResult as any[])[0]?.cnt ?? 0

		const [rows] = await pool.query(
			`SELECT l.id, l.user_id, l.sql_text, l.sql_type, l.status, l.affected_rows, l.row_count, l.duration_ms, l.error_message, l.created_at, u.name AS user_name
			 FROM sql_audit_logs l
			 LEFT JOIN users u ON l.user_id = u.id
			 ORDER BY l.created_at DESC
			 LIMIT ? OFFSET ?`,
			[pageSize, offset],
		)

		return c.json<ApiResponse>({ success: true, data: { items: rows, total, page, pageSize } })
	} catch (err: any) {
		return c.json<ApiResponse>(
			{ success: false, message: err.message || '获取历史失败' },
			HTTP_STATUS.INTERNAL_SERVER_ERROR,
		)
	}
})

export default sqlConsoleRoutes
