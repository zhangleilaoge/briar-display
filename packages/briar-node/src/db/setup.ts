#!/usr/bin/env node
import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"
import mysql from "mysql2/promise"
import { DatabaseConfig } from "../config/database.js"
import fs from "fs"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 从项目根目录加载 .env 文件
const envPath = path.resolve(__dirname, "../../../../.env")
dotenv.config({ path: envPath })

const setupDatabase = async () => {
  console.log("=".repeat(60))
  console.log("🔧 开始初始化数据库...")
  console.log("=".repeat(60))
  console.log(`📍 数据库主机: ${DatabaseConfig.host}`)
  console.log(`📍 数据库端口: ${DatabaseConfig.port}`)
  console.log(`📍 数据库用户: ${DatabaseConfig.user}`)
  console.log(`📍 数据库名称: ${DatabaseConfig.database}`)
  console.log("=".repeat(60))

  let connection: mysql.Connection | null = null

  try {
    // 先连接到 MySQL 服务器（不指定数据库）
    connection = await mysql.createConnection({
      host: DatabaseConfig.host,
      port: DatabaseConfig.port,
      user: DatabaseConfig.user,
      password: DatabaseConfig.password,
      multipleStatements: true,
    })

    console.log("✅ 数据库连接成功")

    // 读取并执行 SQL 文件
    const schemaPath = path.join(__dirname, "schema.sql")
    const schemaSql = fs.readFileSync(schemaPath, "utf-8")

    console.log("\n📝 执行数据库脚本...")

    // 去除注释并分割 SQL 语句
    const cleanSql = schemaSql
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n")

    const statements = cleanSql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)

    console.log(`\n📊 共解析出 ${statements.length} 条 SQL 语句\n`)

    for (const statement of statements) {
      if (statement) {
        try {
          await connection.query(statement)
          // 只输出 CREATE 和 USE 语句的摘要
          const firstLine = statement.split("\n")[0]
          console.log(`  ✓ ${firstLine}`)
        } catch (error: any) {
          // 如果数据库或表已存在，跳过错误
          if (
            error.code === "ER_TABLE_EXISTS_ERROR" ||
            error.code === "ER_DB_CREATE_EXISTS"
          ) {
            const firstLine = statement.split("\n")[0]
            console.log(`  ⊙ ${firstLine} (已存在)`)
          } else {
            console.error(`\n❌ 执行 SQL 失败: ${error.message}`)
            console.error(`   SQL: ${statement.substring(0, 100)}...`)
            throw error
          }
        }
      }
    }

    console.log("\n✅ 数据库初始化完成！")
    console.log("=".repeat(60))

    await connection.end()
    process.exit(0)
  } catch (error) {
    console.error("\n❌ 数据库初始化失败:", error)
    if (connection) {
      await connection.end()
    }
    process.exit(1)
  }
}

setupDatabase()
