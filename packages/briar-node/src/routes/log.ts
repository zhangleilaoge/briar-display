import { Hono } from 'hono'
import { logController } from '../controllers/logController'

const logRoutes = new Hono()

logRoutes.get('/trace/:traceId', (c) => logController.getByTraceId(c))
logRoutes.get('/slow', (c) => logController.getSlowRequests(c))
logRoutes.get('/errors', (c) => logController.getErrors(c))

export default logRoutes
