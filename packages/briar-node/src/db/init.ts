import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { getPool } from "../lib/db"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * 初始化数据库表结构
 */
export const initDatabase = async (): Promise<void> => {
  try {
    const pool = getPool()
    const schemaPath = path.join(__dirname, "schema.sql")
    const schemaSql = fs.readFileSync(schemaPath, "utf-8")

    // 分割 SQL 语句（简单处理，生产环境建议使用专业的迁移工具）
    const statements = schemaSql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"))

    for (const statement of statements) {
      if (statement) {
        await pool.query(statement)
      }
    }

    console.log("✅ 数据库表结构初始化完成")
  } catch (error) {
    console.error("❌ 数据库初始化失败:", error)
    throw error
  }
}

/**
 * 检查数据库连接
 */
export const checkDatabase = async (): Promise<boolean> => {
  try {
    const pool = getPool()
    await pool.query("SELECT 1")
    console.log("✅ 数据库连接正常")
    return true
  } catch (error) {
    console.error("❌ 数据库连接失败:", error)
    return false
  }
}
