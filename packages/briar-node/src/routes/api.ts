import { Hono } from 'hono'
import adminRoutes from './admin'
import authRoutes from './auth'
import certRoutes from './cert'
import imageRoutes from './images'
import logRoutes from './log'
import readmeAiRoutes from './readmeAi'
import userRoutes from './users'
import wikiRoutes from './wiki'

const api = new Hono()

// 注册路由
api.route('/auth', authRoutes)
api.route('/admin', adminRoutes)
api.route('/cert', certRoutes)
api.route('/wiki', wikiRoutes)
api.route('/readme-ai', readmeAiRoutes)
api.route('/logs', logRoutes)
api.route('/images', imageRoutes)
api.route('/users', userRoutes)

// 在此添加其他 API 路由...

export default api
