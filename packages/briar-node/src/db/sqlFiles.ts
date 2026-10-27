import fs from 'fs'
import path from 'path'
import type mysql from 'mysql2/promise'

/**
 * 建库 / 部署共用的 SQL 执行顺序：schema.sql（完整目标态结构）→ migrate.sql（临时迁移，可为空）。
 * scripts/deploy.sh 用 mysql 客户端按同样顺序执行。
 */
export const SQL_FILES = ['schema.sql', 'migrate.sql'] as const

/** 去掉整行注释后是否还有语句（migrate.sql 清空后只剩头注释，mysql2 执行空查询会报错） */
export const hasStatements = (sql: string) =>
	sql
		.split('\n')
		.filter((line) => !line.trim().startsWith('--'))
		.join('\n')
		.trim().length > 0

export const runSqlFiles = async (connection: mysql.Connection, dir: string) => {
	for (const file of SQL_FILES) {
		const sql = fs.readFileSync(path.join(dir, file), 'utf-8')
		if (!hasStatements(sql)) {
			console.log(`  ⊙ ${file}（无语句，跳过）`)
			continue
		}
		console.log(`\n📝 执行 ${file} ...`)
		await connection.query(sql)
		console.log(`  ✓ ${file}`)
	}
}
