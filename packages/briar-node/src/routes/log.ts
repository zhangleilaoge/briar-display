import { PERMISSIONS } from '@briar/shared'
import { Hono } from 'hono'
import { logController } from '../controllers/logController'
import { requirePermission } from '../middleware/permissionMiddleware'

const logRoutes = new Hono()

logRoutes.get('/trace/:traceId', requirePermission(PERMISSIONS.ADMIN_ROLE_MANAGE), (c) =>
	logController.getByTraceId(c),
)
logRoutes.get('/slow', requirePermission(PERMISSIONS.ADMIN_ROLE_MANAGE), (c) =>
	logController.getSlowRequests(c),
)
logRoutes.get('/errors', requirePermission(PERMISSIONS.ADMIN_ROLE_MANAGE), (c) =>
	logController.getErrors(c),
)

export default logRoutes
