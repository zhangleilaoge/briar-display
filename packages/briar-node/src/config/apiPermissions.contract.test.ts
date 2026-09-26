import { describe, expect, test } from 'bun:test'
import api from '../routes/api'
import { API_ROUTE_PERMISSIONS, findApiPermission } from './apiPermissions'
import { RouteConfig } from './routes'

const WRITE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE']

/** 所有已注册的写路由（Hono 内省 api.routes，路径补 /api 前缀；同一路由的多个 handler 各产生一条记录，需去重） */
const writeRoutes = [
	...new Map(
		api.routes
			.map((r) => ({ method: r.method.toUpperCase(), path: `/api${r.path}` }))
			.filter((r) => WRITE_METHODS.includes(r.method))
			.map((r) => [`${r.method} ${r.path}`, r] as const),
	).values(),
]

describe('写路由权限契约（apiWriteGuard 安全网）', () => {
	test('所有写路由都已在 apiPermissions.ts 声明（未声明 = 线上 403）', () => {
		const undeclared = writeRoutes
			.filter((r) => findApiPermission(r.method, r.path) === undefined)
			.map((r) => `${r.method} ${r.path}`)
		expect(undeclared).toEqual([])
	})

	test('权限映射表中的每条都对应真实注册的路由（防止拼错/遗留死配置）', () => {
		const registered = new Set(writeRoutes.map((r) => `${r.method} ${r.path}`))
		const stale = Object.keys(API_ROUTE_PERMISSIONS).filter((key) => !registered.has(key))
		expect(stale).toEqual([])
	})

	test('免登录路径（API_UNRESTRICTED_PATHS）不得声明权限（语义冲突：免登录跳过 JWT，配权限必 401）', () => {
		for (const path of RouteConfig.API_UNRESTRICTED_PATHS) {
			for (const method of WRITE_METHODS) {
				const permission = findApiPermission(method, path)
				// undefined（无此写路由）或 null（显式公开）都合法，绝不能是权限编码
				expect(permission ?? null).toBeNull()
			}
		}
	})
})
