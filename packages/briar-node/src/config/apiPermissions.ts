import { PERMISSIONS } from '@briar/shared'

/**
 * 全局 API 写操作权限映射表
 *
 * 格式: 'METHOD /full/api/path' → 权限编码 | null
 *
 * 规则：
 * - GET/HEAD/OPTIONS 请求不受此表约束（默认公开，由 authMiddleware 控制）
 * - POST/PUT/PATCH/DELETE 必须在此表中声明权限
 * - null = 显式公开（如登录/注册）
 * - 未声明的写路由 → 默认拒绝（403 + 控制台警告）
 *
 * 新增写路由时必须在此表中添加条目，否则会被拦截。
 */
export const API_ROUTE_PERMISSIONS: Record<string, string | null> = {
	// ==================== Auth（公开） ====================
	'POST /api/auth/login': null,
	'POST /api/auth/register': null,
	'POST /api/auth/send-reset-code': null,
	'POST /api/auth/reset-password': null,

	// ==================== Admin ====================
	'POST /api/admin/roles': PERMISSIONS.ADMIN_ROLE_MANAGE,
	'PUT /api/admin/roles/:id': PERMISSIONS.ADMIN_ROLE_MANAGE,
	'DELETE /api/admin/roles/:id': PERMISSIONS.ADMIN_ROLE_MANAGE,
	'PUT /api/admin/roles/:id/permissions': PERMISSIONS.ADMIN_ROLE_MANAGE,
	'POST /api/admin/roles/:id/permissions': PERMISSIONS.ADMIN_ROLE_MANAGE,
	'PUT /api/admin/users/:id/roles': PERMISSIONS.ADMIN_USER_ROLE_ASSIGN,
	'POST /api/admin/users/:id/roles': PERMISSIONS.ADMIN_USER_ROLE_ASSIGN,
	'DELETE /api/admin/users/:id/roles': PERMISSIONS.ADMIN_USER_ROLE_ASSIGN,
	'PUT /api/admin/users/:id': PERMISSIONS.ADMIN_USER_MANAGE,

	// ==================== SQL Console ====================
	'POST /api/admin/sql/execute': PERMISSIONS.ADMIN_SQL_EXECUTE,

	// ==================== Cert ====================
	'POST /api/cert/renew': PERMISSIONS.ADMIN_DEPLOY_MANAGE,

	// ==================== Deployment ====================
	'POST /api/deployment/nginx/deploy': PERMISSIONS.ADMIN_DEPLOY_MANAGE,

	// ==================== Files（文件管理，登录用户即可） ====================
	'POST /api/files/precheck': null,
	'POST /api/files/cos-sign': null,
	'POST /api/files/confirm': null,
	'POST /api/files/folders': null,
	'PATCH /api/files/folders/:id': null,
	'DELETE /api/files/folders/:id': null,
	'PATCH /api/files/:id': null,
	'DELETE /api/files/:id': null,

	// ==================== Messages（站内信，登录用户即可） ====================
	'POST /api/messages/read-all': null,
	'POST /api/messages/:id/read': null,

	// ==================== Media（工具箱-媒体解析，登录用户即可） ====================
	'POST /api/media/parse': null,

	// ==================== Scheduler（定时任务管理） ====================
	'POST /api/scheduler/tasks/:name/run': PERMISSIONS.ADMIN_DEPLOY_MANAGE,

	// ==================== Terminal（SSH 控制台设备授权） ====================
	'POST /api/terminal/verification-code': PERMISSIONS.ADMIN_TERMINAL_ACCESS,
	'POST /api/terminal/verify-device': PERMISSIONS.ADMIN_TERMINAL_ACCESS,

	// ==================== Logs ====================
	// GET-only, no write routes needed

	// ==================== Users ====================
	'PUT /api/users/me': null,
	'POST /api/users/me/avatar': null,
}

/**
 * 根据 HTTP method 和完整 API 路径查找所需权限
 * 支持参数化路径匹配（:slug 等）
 */
export function findApiPermission(method: string, path: string): string | null | undefined {
	const key = `${method} ${path}`

	// 精确匹配
	if (key in API_ROUTE_PERMISSIONS) {
		return API_ROUTE_PERMISSIONS[key]
	}

	// 参数化路径匹配
	for (const [pattern, permission] of Object.entries(API_ROUTE_PERMISSIONS)) {
		const [patternMethod, patternPath] = pattern.split(' ')
		if (patternMethod !== method) continue

		if (matchPath(patternPath, path)) {
			return permission
		}
	}

	// 未找到 → undefined（表示未声明）
	return undefined
}

/**
 * 参数化路径匹配
 * /api/files/folders/:id 匹配 /api/files/folders/abc-123
 */
function matchPath(pattern: string, actual: string): boolean {
	const patternParts = pattern.split('/')
	const actualParts = actual.split('/')

	if (patternParts.length !== actualParts.length) return false

	for (let i = 0; i < patternParts.length; i++) {
		if (patternParts[i].startsWith(':')) continue // 参数通配
		if (patternParts[i] !== actualParts[i]) return false
	}

	return true
}
