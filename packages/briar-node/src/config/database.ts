import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 从项目根目录加载 .env 文件
const envPath = path.resolve(__dirname, "../../../../.env")
dotenv.config({ path: envPath })

export const DatabaseConfig = {
  host: process.env.BRIAR_DATABASE_HOST || "localhost",
  port: Number(process.env.BRIAR_DATABASE_PORT) || 3306,
  user: process.env.BRIAR_DATABASE_USER || "root",
  password: process.env.BRIAR_DATABASE_PASSWORD || "",
  database: "briar_display",
  connectionLimit: 10,
  waitForConnections: true,
  queueLimit: 0,
} as const
