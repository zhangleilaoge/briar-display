import { Hono } from 'hono'
import authRoutes from './auth'
import certRoutes from './cert'
import wikiRoutes from './wiki'

const api = new Hono()

// 注册路由
api.route('/auth', authRoutes)
api.route('/cert', certRoutes)
api.route('/wiki', wikiRoutes)

// 在此添加其他 API 路由...
// api.route("/users", userRoutes)
// api.route("/posts", postRoutes)

export default api
