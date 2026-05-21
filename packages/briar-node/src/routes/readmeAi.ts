import { Hono } from 'hono'
import { readmeAiController } from '../controllers/readmeAiController'

const readmeAiRoutes = new Hono()

// 公开路由 - 读取 readme.ai.md
readmeAiRoutes.get('/', (c) => readmeAiController.read(c))

// 公开路由 - 初始化 readme.ai.md
readmeAiRoutes.post('/init', (c) => readmeAiController.init(c))

// 公开路由 - 重写 readme.ai.md
readmeAiRoutes.post('/rewrite', (c) => readmeAiController.rewrite(c))

// 公开路由 - 删除 readme.ai.md
readmeAiRoutes.delete('/', (c) => readmeAiController.delete(c))

export default readmeAiRoutes
