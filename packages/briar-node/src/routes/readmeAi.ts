import { PERMISSIONS } from '@briar/shared'
import { Hono } from 'hono'
import { readmeAiController } from '../controllers/readmeAiController'
import { requirePermission } from '../middleware/permissionMiddleware'

const readmeAiRoutes = new Hono()

// 公开路由 - 读取 readme.ai.md
readmeAiRoutes.get('/', (c) => readmeAiController.read(c))

// 需要认证的写操作
readmeAiRoutes.post('/init', requirePermission(PERMISSIONS.ADMIN_ROLE_MANAGE), (c) =>
	readmeAiController.init(c),
)

readmeAiRoutes.post('/rewrite', requirePermission(PERMISSIONS.ADMIN_ROLE_MANAGE), (c) =>
	readmeAiController.rewrite(c),
)

readmeAiRoutes.delete('/', requirePermission(PERMISSIONS.ADMIN_ROLE_MANAGE), (c) =>
	readmeAiController.delete(c),
)

export default readmeAiRoutes
