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

	// ==================== Files ====================
	'POST /api/files/precheck': PERMISSIONS.WIKI_PAGE_CREATE,
	'POST /api/files/cos-sign': PERMISSIONS.WIKI_PAGE_CREATE,
	'POST /api/files/confirm': PERMISSIONS.WIKI_PAGE_CREATE,
	'POST /api/files/folders': PERMISSIONS.WIKI_PAGE_CREATE,
	'PATCH /api/files/folders/:id': PERMISSIONS.WIKI_PAGE_CREATE,
	'DELETE /api/files/folders/:id': PERMISSIONS.WIKI_PAGE_CREATE,
	'PATCH /api/files/:id': PERMISSIONS.WIKI_PAGE_CREATE,
	'DELETE /api/files/:id': PERMISSIONS.WIKI_PAGE_CREATE,

	// ==================== Messages（站内信，登录用户即可） ====================
	'POST /api/messages/read-all': null,
	'POST /api/messages/:id/read': null,

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

	// ==================== Wiki: Pages ====================
	'POST /api/wiki/pages': PERMISSIONS.WIKI_PAGE_CREATE,
	'PUT /api/wiki/pages/:slug': PERMISSIONS.WIKI_PAGE_UPDATE,
	'DELETE /api/wiki/pages/:slug': PERMISSIONS.WIKI_PAGE_DELETE,

	// ==================== Wiki: Revisions ====================
	'POST /api/wiki/pages/:slug/revisions/:revId/revert': PERMISSIONS.WIKI_REVISION_REVERT,

	// ==================== Wiki: Discussions ====================
	'POST /api/wiki/pages/:slug/discussions': PERMISSIONS.WIKI_DISCUSSION_CREATE,
	'POST /api/wiki/pages/:slug/discussions/:topicId/replies': PERMISSIONS.WIKI_DISCUSSION_REPLY,
	'PUT /api/wiki/pages/:slug/discussions/:topicId/resolve': PERMISSIONS.WIKI_DISCUSSION_RESOLVE,

	// ==================== Wiki: Comments ====================
	'POST /api/wiki/pages/:slug/comments': PERMISSIONS.WIKI_COMMENT_CREATE,
	'PUT /api/wiki/pages/:slug/comments/:id': PERMISSIONS.WIKI_COMMENT_UPDATE,
	'DELETE /api/wiki/pages/:slug/comments/:id': PERMISSIONS.WIKI_COMMENT_DELETE,

	// ==================== Wiki: Change Requests ====================
	'POST /api/wiki/pages/:slug/change-requests': PERMISSIONS.WIKI_CHANGE_REQUEST_CREATE,
	'PUT /api/wiki/change-requests/:id/review': PERMISSIONS.WIKI_CHANGE_REQUEST_REVIEW,
	'DELETE /api/wiki/change-requests/:id': PERMISSIONS.WIKI_CHANGE_REQUEST_CREATE,

	// ==================== Wiki: Categories ====================
	'POST /api/wiki/categories': PERMISSIONS.WIKI_CATEGORY_CREATE,
	'PUT /api/wiki/categories/:slug': PERMISSIONS.WIKI_CATEGORY_UPDATE,
	'DELETE /api/wiki/categories/:slug': PERMISSIONS.WIKI_CATEGORY_DELETE,
	'POST /api/wiki/categories/:slug/pages': PERMISSIONS.WIKI_CATEGORY_UPDATE,
	'DELETE /api/wiki/categories/:slug/pages/:pageId': PERMISSIONS.WIKI_CATEGORY_UPDATE,

	// ==================== Wiki: Tags ====================
	'POST /api/wiki/tags': PERMISSIONS.WIKI_TAG_CREATE,
	'DELETE /api/wiki/tags/:id': PERMISSIONS.WIKI_TAG_DELETE,

	// ==================== Wiki: Templates ====================
	'POST /api/wiki/templates': PERMISSIONS.WIKI_TEMPLATE_CREATE,
	'PUT /api/wiki/templates/:slug': PERMISSIONS.WIKI_TEMPLATE_UPDATE,
	'DELETE /api/wiki/templates/:slug': PERMISSIONS.WIKI_TEMPLATE_DELETE,

	// ==================== Wiki: Stars ====================
	'POST /api/wiki/stars/:slug': PERMISSIONS.WIKI_STAR_MANAGE,
	'DELETE /api/wiki/stars/:slug': PERMISSIONS.WIKI_STAR_MANAGE,

	// ==================== Wiki: Watchlist ====================
	'POST /api/wiki/watchlist/:slug': PERMISSIONS.WIKI_WATCHLIST_MANAGE,
	'DELETE /api/wiki/watchlist/:slug': PERMISSIONS.WIKI_WATCHLIST_MANAGE,
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
 * /api/wiki/pages/:slug 匹配 /api/wiki/pages/hello-world
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
