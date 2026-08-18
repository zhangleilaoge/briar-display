import path from 'path'
import { fileURLToPath } from 'url'
import { APP_NAME, NODE_PORT } from '@briar/shared'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { checkDatabase } from './db/init'
import { patchConsoleWithTrace } from './lib/logger'
import { releasePort } from './lib/port'
import { startScheduler } from './lib/scheduler'
import { schedulerTasks } from './lib/schedulerConfig'
import { applyConfiguredMiddlewares, globalMiddlewares } from './middleware/config'
import apiRoutes from './routes/api'
import { rootHandler } from './routes/root'
import { setupTerminalWebSocket } from './routes/terminalWs'

// 包装 console.*：请求上下文内的主动日志自动带 [traceId] 前缀（配合 traceIdMiddleware 的 ALS）
patchConsoleWithTrace()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PORT = process.env.PORT || NODE_PORT

// 优先使用 web/ 目录（GitHub Actions 部署的线上资源），fallback 到 dist/（本地构建）
const WEB_PATH = path.resolve(__dirname, '../../briar-display/web')
const DIST_PATH = path.resolve(__dirname, '../../briar-display/dist')
const fs = await import('fs')
const isDev = process.env.NODE_ENV !== 'production'
const STATIC_PATH = isDev ? DIST_PATH : fs.existsSync(WEB_PATH) ? WEB_PATH : DIST_PATH

// 启动时校验前端资源目录，避免 CI 同步错路径后静默读旧文件
const validateStaticPath = () => {
	if (isDev) return
	const indexHtml = path.join(STATIC_PATH, 'index.html')
	if (!fs.existsSync(STATIC_PATH)) {
		console.warn(
			`⚠️  前端资源目录不存在: ${STATIC_PATH}\n   生产环境应由 CI 同步到 packages/briar-display/web\n   当前将 fallback 到 dist（可能是旧构建）`,
		)
	} else if (!fs.existsSync(indexHtml)) {
		console.warn(
			`⚠️  前端资源目录缺少 index.html: ${STATIC_PATH}\n   可能是同步中断或路径错误，前端页面将无法访问`,
		)
	} else {
		console.log(`✅ 前端资源目录就绪: ${STATIC_PATH}`)
	}
}
validateStaticPath()

const app = new Hono()

// 全局中间件
applyConfiguredMiddlewares(app, globalMiddlewares, '/*')

// API 路由
app.route('/api', apiRoutes)

// 根路径落地页（备案合规）：须在静态资源中间件之前注册
app.get('/', rootHandler)

// 静态资源
app.use('/*', serveStatic({ root: STATIC_PATH }))

// Wiki SPA fallback: /briar/wiki/* 动态路由都返回 wiki/index.html
app.get('/briar/wiki/*', async (c) => {
	const wikiIndexPath = path.join(STATIC_PATH, 'briar/wiki/index.html')
	if (fs.existsSync(wikiIndexPath)) {
		const html = fs.readFileSync(wikiIndexPath, 'utf-8')
		return c.html(html)
	}
	// fallback to root
	const rootIndexPath = path.join(STATIC_PATH, 'index.html')
	const html = fs.readFileSync(rootIndexPath, 'utf-8')
	return c.html(html)
})

// 文件管理 SPA fallback: /briar/files/<folderId> 返回 files/index.html
app.get('/briar/files/*', async (c) => {
	const filesIndexPath = path.join(STATIC_PATH, 'briar/files/index.html')
	if (fs.existsSync(filesIndexPath)) {
		const html = fs.readFileSync(filesIndexPath, 'utf-8')
		return c.html(html)
	}
	const rootIndexPath = path.join(STATIC_PATH, 'index.html')
	const html = fs.readFileSync(rootIndexPath, 'utf-8')
	return c.html(html)
})

// 其他页面 fallback
app.get('/*', serveStatic({ path: './index.html', root: STATIC_PATH }))

const startServer = async () => {
	console.log('='.repeat(60))
	console.log(`🚀 ${APP_NAME} 服务器启动中...`)
	console.log('='.repeat(60))

	await releasePort(Number(PORT))

	const dbConnected = await checkDatabase()
	if (!dbConnected) {
		console.error('❌ 数据库连接失败，服务器启动终止')
		process.exit(1)
	}

	console.log(`📦 前端资源目录: ${STATIC_PATH}`)
	console.log(`🌐 服务器地址: http://localhost:${PORT}`)
	console.log('='.repeat(60))

	startScheduler(schedulerTasks)

	const server = serve({ fetch: app.fetch, port: Number(PORT) })
	setupTerminalWebSocket(server)
}

startServer().catch((error) => {
	console.error('❌ 服务器启动失败:', error)
	process.exit(1)
})

export default app
