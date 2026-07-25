#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import mysql from 'mysql2/promise'
import { DatabaseConfig } from '../config/database.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 从项目根目录加载 .env 文件
const envPath = path.resolve(__dirname, '../../../../.env')
dotenv.config({ path: envPath })

const runMigrate = async () => {
	console.log('='.repeat(60))
	console.log('🔧 开始执行数据库迁移...')
	console.log('='.repeat(60))
	console.log(`📍 数据库主机: ${DatabaseConfig.host}`)
	console.log(`📍 数据库端口: ${DatabaseConfig.port}`)
	console.log(`📍 数据库用户: ${DatabaseConfig.user}`)
	console.log(`📍 数据库名称: ${DatabaseConfig.database}`)
	console.log('='.repeat(60))

	let connection: mysql.Connection | null = null

	try {
		connection = await mysql.createConnection({
			host: DatabaseConfig.host,
			port: DatabaseConfig.port,
			user: DatabaseConfig.user,
			password: DatabaseConfig.password,
			database: DatabaseConfig.database,
			multipleStatements: true,
			connectTimeout: 60000,
		})

		console.log('✅ 数据库连接成功')

		const migratePath = path.join(__dirname, 'migrate.sql')
		const migrateSql = fs.readFileSync(migratePath, 'utf-8')

		console.log('\n📝 执行迁移脚本...')
		await connection.query(migrateSql)
		console.log('\n✅ 数据库迁移完成！')
		console.log('='.repeat(60))

		await connection.end()
		process.exit(0)
	} catch (error) {
		console.error('\n❌ 数据库迁移失败:', error)
		if (connection) {
			await connection.end()
		}
		process.exit(1)
	}
}

runMigrate()
