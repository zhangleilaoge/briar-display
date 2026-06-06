import { PERMISSIONS } from '@briar/shared'

/**
 * Wiki 路由权限映射表
 *
 * 格式: 'METHOD /path' → 权限编码
 *
 * 规则：
 * - GET 请求默认公开（不需要权限）
 * - POST/PUT/DELETE 请求必须声明权限
 * - 新增写路由如果不在此表中，会被默认保护中间件拦截（403）
 * - 如需公开某个写路由，显式标记为 null
 */
export const WIKI_ROUTE_PERMISSIONS: Record<string, string | null> = {
	// ==================== Pages ====================
	'POST /pages': PERMISSIONS.WIKI_PAGE_CREATE,
	'PUT /pages/:slug': PERMISSIONS.WIKI_PAGE_UPDATE,
	'DELETE /pages/:slug': PERMISSIONS.WIKI_PAGE_DELETE,

	// ==================== Revisions ====================
	'POST /pages/:slug/revisions/:revId/revert': PERMISSIONS.WIKI_REVISION_REVERT,

	// ==================== Discussions ====================
	'POST /pages/:slug/discussions': PERMISSIONS.WIKI_DISCUSSION_CREATE,
	'POST /pages/:slug/discussions/:topicId/replies': PERMISSIONS.WIKI_DISCUSSION_REPLY,
	'PUT /pages/:slug/discussions/:topicId/resolve': PERMISSIONS.WIKI_DISCUSSION_RESOLVE,

	// ==================== Comments ====================
	'POST /pages/:slug/comments': PERMISSIONS.WIKI_COMMENT_CREATE,
	'PUT /pages/:slug/comments/:id': PERMISSIONS.WIKI_COMMENT_UPDATE,
	'DELETE /pages/:slug/comments/:id': PERMISSIONS.WIKI_COMMENT_DELETE,

	// ==================== Change Requests ====================
	'POST /pages/:slug/change-requests': PERMISSIONS.WIKI_CHANGE_REQUEST_CREATE,
	'PUT /change-requests/:id/review': PERMISSIONS.WIKI_CHANGE_REQUEST_REVIEW,
	'DELETE /change-requests/:id': PERMISSIONS.WIKI_CHANGE_REQUEST_CREATE,

	// ==================== Categories ====================
	'POST /categories': PERMISSIONS.WIKI_CATEGORY_CREATE,
	'PUT /categories/:slug': PERMISSIONS.WIKI_CATEGORY_UPDATE,
	'DELETE /categories/:slug': PERMISSIONS.WIKI_CATEGORY_DELETE,
	'POST /categories/:slug/pages': PERMISSIONS.WIKI_CATEGORY_UPDATE,
	'DELETE /categories/:slug/pages/:pageId': PERMISSIONS.WIKI_CATEGORY_UPDATE,

	// ==================== Tags ====================
	'POST /tags': PERMISSIONS.WIKI_TAG_CREATE,
	'DELETE /tags/:id': PERMISSIONS.WIKI_TAG_DELETE,

	// ==================== Templates ====================
	'POST /templates': PERMISSIONS.WIKI_TEMPLATE_CREATE,
	'PUT /templates/:slug': PERMISSIONS.WIKI_TEMPLATE_UPDATE,
	'DELETE /templates/:slug': PERMISSIONS.WIKI_TEMPLATE_DELETE,

	// ==================== Stars ====================
	'POST /stars/:slug': PERMISSIONS.WIKI_STAR_MANAGE,
	'DELETE /stars/:slug': PERMISSIONS.WIKI_STAR_MANAGE,

	// ==================== Watchlist ====================
	'POST /watchlist/:slug': PERMISSIONS.WIKI_WATCHLIST_MANAGE,
	'DELETE /watchlist/:slug': PERMISSIONS.WIKI_WATCHLIST_MANAGE,
}

/**
 * 根据 HTTP method 和路径查找所需权限
 * 支持参数化路径匹配（:slug 等）
 */
export function findRequiredPermission(method: string, path: string): string | null | undefined {
	const key = `${method} ${path}`

	// 精确匹配
	if (key in WIKI_ROUTE_PERMISSIONS) {
		return WIKI_ROUTE_PERMISSIONS[key]
	}

	// 参数化路径匹配：将实际路径与模式逐一比较
	for (const [pattern, permission] of Object.entries(WIKI_ROUTE_PERMISSIONS)) {
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
 * /pages/:slug 匹配 /pages/hello-world
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
