import { Hono } from "hono"
import { serve } from "@hono/node-server"
import { serveStatic } from "@hono/node-server/serve-static"
import path from "path"
import { fileURLToPath } from "url"
import { exec } from "child_process"
import { promisify } from "util"
import { APP_NAME, NODE_PORT } from "@briar/shared"
import {
  loggerMiddleware,
  corsMiddleware,
  pageAuthMiddleware,
} from "./middleware"
import apiRoutes from "./routes/api"
import { checkDatabase } from "./db/init"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const execAsync = promisify(exec)

// ============ 配置 ============
const PORT = process.env.PORT || NODE_PORT
const DIST_PATH = path.resolve(__dirname, "../../briar-display/dist")

// ============ 应用初始化 ============
const app = new Hono()

// ============ 全局中间件 ============
app.use("/*", loggerMiddleware())
app.use("/*", corsMiddleware())
app.use("/*", pageAuthMiddleware())

// ============ API 路由 ============
app.route("/api", apiRoutes)

// ============ 静态资源服务 ============
app.use("/*", serveStatic({ root: DIST_PATH }))

// ============ SPA 回退 ============
app.get("/*", serveStatic({ path: "./index.html", root: DIST_PATH }))

// ============ 启动服务器 ============
const releasePort = async (port: number) => {
  if (!Number.isFinite(port) || port <= 0) {
    return
  }

  if (process.platform !== "darwin" && process.platform !== "linux") {
    return
  }

  try {
    const { stdout } = await execAsync(`lsof -ti:${port}`)
    const pids = stdout
      .split(/\s+/)
      .map((pid) => pid.trim())
      .filter(Boolean)

    if (pids.length === 0) {
      return
    }

    await execAsync(`kill -9 ${pids.join(" ")}`)
    console.log(`🧹 释放端口 ${port} (PID: ${pids.join(", ")})`)
  } catch (error) {
    const execError = error as { code?: number; message?: string }
    if (execError.code === 1) {
      return
    }
    console.warn("⚠️ 端口释放失败:", execError.message ?? execError)
  }
}

const startServer = async () => {
  console.log("=".repeat(60))
  console.log(`🚀 ${APP_NAME} 服务器启动中...`)
  console.log("=".repeat(60))

  if (typeof PORT === "string" || typeof PORT === "number") {
    await releasePort(Number(PORT))
  }

  // 检查数据库连接
  const dbConnected = await checkDatabase()
  if (!dbConnected) {
    console.error("❌ 数据库连接失败，服务器启动终止")
    process.exit(1)
  }

  console.log(`📦 前端资源目录: ${DIST_PATH}`)
  console.log(`🌐 服务器地址: http://localhost:${PORT}`)
  console.log("=".repeat(60))

  serve({
    fetch: app.fetch,
    port: Number(PORT),
  })
}

startServer().catch((error) => {
  console.error("❌ 服务器启动失败:", error)
  process.exit(1)
})

export default app
