import { getPool } from '../lib/db'

/**
 * 检查数据库连接
 */
export const checkDatabase = async (): Promise<boolean> => {
	try {
		const pool = getPool()
		await pool.query('SELECT 1')
		console.log('✅ 数据库连接正常')
		return true
	} catch (error) {
		console.error('❌ 数据库连接失败:', error)
		return false
	}
}
