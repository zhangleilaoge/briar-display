import { Hono } from 'hono'
import adminRoutes from './admin'
import authRoutes from './auth'
import certRoutes from './cert'
import deploymentRoutes from './deployment'
import fileRoutes from './files'
import logRoutes from './log'
import mediaRoutes from './media'
import messageRoutes from './messages'
import schedulerRoutes from './scheduler'
import sqlConsoleRoutes from './sqlConsole'
import terminalRoutes from './terminal'
import userRoutes from './users'
import versionRoutes from './version'
import wikiRoutes from './wiki'

const api = new Hono()

// 注册路由
// 注意：/api/terminal/ws（WebSocket）不在此注册——Hono 不支持 WS 升级，
// 由 routes/terminalWs.ts 直接挂 http server 的 upgrade 事件（见 index.ts setupTerminalWebSocket）。
api.route('/auth', authRoutes)
api.route('/admin', adminRoutes)
api.route('/admin/sql', sqlConsoleRoutes)
api.route('/cert', certRoutes)
api.route('/deployment', deploymentRoutes)
api.route('/wiki', wikiRoutes)
api.route('/logs', logRoutes)
api.route('/media', mediaRoutes)
api.route('/messages', messageRoutes)
api.route('/scheduler', schedulerRoutes)
api.route('/terminal', terminalRoutes)
api.route('/files', fileRoutes)
api.route('/users', userRoutes)
api.route('/version', versionRoutes)

// 在此添加其他 API 路由...

export default api
