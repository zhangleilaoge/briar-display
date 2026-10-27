#!/usr/bin/env node
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import mysql from 'mysql2/promise'
import { DatabaseConfig } from '../config/database.js'
import { runSqlFiles } from './sqlFiles.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 从项目根目录加载 .env 文件
const envPath = path.resolve(__dirname, '../../../../.env')
dotenv.config({ path: envPath })

const setupDatabase = async () => {
	console.log('='.repeat(60))
	console.log('🔧 开始初始化数据库...')
	console.log('='.repeat(60))
	console.log(`📍 数据库主机: ${DatabaseConfig.host}`)
	console.log(`📍 数据库端口: ${DatabaseConfig.port}`)
	console.log(`📍 数据库用户: ${DatabaseConfig.user}`)
	console.log(`📍 数据库名称: ${DatabaseConfig.database}`)
	console.log('='.repeat(60))

	let connection: mysql.Connection | null = null

	try {
		// 先连接到 MySQL 服务器（不指定数据库）
		connection = await mysql.createConnection({
			host: DatabaseConfig.host,
			port: DatabaseConfig.port,
			user: DatabaseConfig.user,
			password: DatabaseConfig.password,
			multipleStatements: true,
			connectTimeout: 60000,
		})

		console.log('✅ 数据库连接成功')

		// schema.sql 含 CREATE DATABASE / USE；之后执行 migrate.sql（全新库上应为 no-op）
		await runSqlFiles(connection, __dirname)

		console.log('\n✅ 数据库初始化完成！')
		console.log('='.repeat(60))

		await connection.end()
		process.exit(0)
	} catch (error) {
		console.error('\n❌ 数据库初始化失败:', error)
		if (connection) {
			await connection.end()
		}
		process.exit(1)
	}
}

setupDatabase()
