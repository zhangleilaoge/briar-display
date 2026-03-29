import { Hono } from 'hono'
import { wikiController } from '../controllers/wikiController'
import { authMiddleware } from '../middleware/authMiddleware'

const wikiRoutes = new Hono()

// 公开路由 - 获取已发布的文章列表
wikiRoutes.get('/', (c) => wikiController.list(c))

// 公开路由 - 按 slug 获取文章详情
wikiRoutes.get('/slug/:slug', (c) => wikiController.getBySlug(c))

// 公开路由 - 按 ID 获取文章详情
wikiRoutes.get('/:id', (c) => wikiController.getById(c))

// 需要认证的路由 - 获取当前用户的所有文章
wikiRoutes.get('/user/my', authMiddleware, (c) => wikiController.myWikis(c))

// 需要认证的路由 - 创建新文章
wikiRoutes.post('/', authMiddleware, (c) => wikiController.create(c))

// 需要认证的路由 - 更新文章
wikiRoutes.put('/:id', authMiddleware, (c) => wikiController.update(c))

// 需要认证的路由 - 删除文章
wikiRoutes.delete('/:id', authMiddleware, (c) => wikiController.delete(c))

// 公开路由 - 增加浏览次数
wikiRoutes.post('/:id/view', (c) => wikiController.addView(c))

export default wikiRoutes
