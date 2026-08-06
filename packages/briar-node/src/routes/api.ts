import { Hono } from 'hono'
import adminRoutes from './admin'
import authRoutes from './auth'
import certRoutes from './cert'
import deploymentRoutes from './deployment'
import fileRoutes from './files'
import logRoutes from './log'
import messageRoutes from './messages'
import readmeAiRoutes from './readmeAi'
import schedulerRoutes from './scheduler'
import sqlConsoleRoutes from './sqlConsole'
import userRoutes from './users'
import versionRoutes from './version'
import wikiRoutes from './wiki'

const api = new Hono()

// 注册路由
api.route('/auth', authRoutes)
api.route('/admin', adminRoutes)
api.route('/admin/sql', sqlConsoleRoutes)
api.route('/cert', certRoutes)
api.route('/deployment', deploymentRoutes)
api.route('/wiki', wikiRoutes)
api.route('/readme-ai', readmeAiRoutes)
api.route('/logs', logRoutes)
api.route('/messages', messageRoutes)
api.route('/scheduler', schedulerRoutes)
api.route('/files', fileRoutes)
api.route('/users', userRoutes)
api.route('/version', versionRoutes)

// 在此添加其他 API 路由...

export default api
