import type { Context, MiddlewareHandler } from 'hono'
import { isApiPublicPath, isAssetPath, isPublicPath } from '../config/routes'
import { apiWriteGuard } from './apiWriteGuard'
import { authMiddleware } from './authMiddleware'
import { corsMiddleware, errorHandler, loggerMiddleware, pageAuthMiddleware } from './index'
import { traceIdMiddleware } from './traceId'

export type MiddlewareMatch = (c: Context) => boolean
export type MiddlewareIgnore = (c: Context) => boolean

export type MiddlewareConfig = {
	middleware: MiddlewareHandler
	match?: MiddlewareMatch
	ignore?: MiddlewareIgnore
	priority?: number
}

const shouldIgnorePageAuth = (c: Context): boolean => {
	const pathname = c.req.path
	return pathname.startsWith('/api') || isAssetPath(pathname) || isPublicPath(pathname)
}

export const globalMiddlewares: MiddlewareConfig[] = [
	{
		middleware: traceIdMiddleware(),
		priority: 0,
	},
	{
		middleware: errorHandler(),
		priority: 1,
	},
	{
		middleware: loggerMiddleware(),
		priority: 10,
	},
	{
		middleware: corsMiddleware(),
		priority: 20,
	},
	{
		middleware: authMiddleware,
		match: (c) => c.req.path.startsWith('/api'),
		ignore: (c) => isApiPublicPath(c.req.path, c.req.method),
		priority: 30,
	},
	{
		middleware: apiWriteGuard,
		match: (c) => c.req.path.startsWith('/api'),
		priority: 35,
	},
	{
		middleware: pageAuthMiddleware(),
		ignore: shouldIgnorePageAuth,
		priority: 99,
	},
]

export const applyConfiguredMiddlewares = (
	app: { use: (path: string, ...handlers: MiddlewareHandler[]) => void },
	configs: MiddlewareConfig[],
	defaultPath = '/*',
) => {
	const sorted = [...configs].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))

	for (const config of sorted) {
		const handler: MiddlewareHandler = async (c, next) => {
			if (config.match && !config.match(c)) {
				return next()
			}
			if (config.ignore?.(c)) {
				return next()
			}
			return config.middleware(c, next)
		}

		app.use(defaultPath, handler)
	}
}
