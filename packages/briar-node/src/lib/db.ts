import mysql from 'mysql2/promise'
import { DatabaseConfig } from '../config/database'

let pool: mysql.Pool | null = null

/**
 * 获取数据库连接池
 */
export const getPool = (): mysql.Pool => {
	if (!pool) {
		pool = mysql.createPool(DatabaseConfig)
		console.log('✅ 数据库连接池已创建')
	}
	return pool
}

/**
 * 清理参数，确保数字是原始类型
 */
const cleanValues = (values?: any[]): any[] | undefined => {
	if (!values) return values
	return values.map((v) => {
		if (typeof v === 'number' && !Object.is(v, Number.NaN)) {
			return +v // 确保是原始数字
		}
		return v
	})
}

/**
 * 执行查询
 */
export const query = async <T = any>(sql: string, values?: any[]): Promise<T[]> => {
	const pool = getPool()
	const [rows] = await pool.execute(sql, cleanValues(values))
	return rows as T[]
}

/**
 * 执行单条查询
 */
export const queryOne = async <T = any>(sql: string, values?: any[]): Promise<T | null> => {
	const results = await query<T>(sql, values)
	return results[0] || null
}

/**
 * 执行插入/更新/删除操作
 */
export const execute = async (sql: string, values?: any[]): Promise<mysql.ResultSetHeader> => {
	const pool = getPool()
	const [result] = await pool.execute(sql, cleanValues(values))
	return result as mysql.ResultSetHeader
}

/**
 * 关闭连接池
 */
export const closePool = async (): Promise<void> => {
	if (pool) {
		await pool.end()
		pool = null
		console.log('✅ 数据库连接池已关闭')
	}
}
