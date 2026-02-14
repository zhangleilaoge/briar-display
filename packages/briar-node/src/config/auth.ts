import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 从项目根目录加载 .env 文件
const envPath = path.resolve(__dirname, "../../../../.env")
dotenv.config({ path: envPath })

export const AUTH_CONFIG = {
  jwtSecret: process.env.BRIAR_JWT_SECRET || "briar_dev_secret",
  jwtExpiresIn: "7d",
}
