/**
 * 路由配置
 * 定义公共路径和需要认证的路径规则
 */

export const RouteConfig = {
	/** 完全公开的路径（前端页面） */
	PUBLIC_PATHS: new Set([
		'/', // 根路径落地页（备案合规）
		'/briar-display/login',
		'/briar-display/register',
		'/briar-display/forgot-password',
	]),

	/** 公开的路径前缀 */
	PUBLIC_PREFIXES: ['/demo'],

	/** 所有方法都公开的 API 路径（跳过 JWT 验证，如登录/注册）
	 *  与 apiPermissions.ts 中标记为 null 的条目保持一致 */
	API_UNRESTRICTED_PATHS: [
		'/api/auth/login',
		'/api/auth/register',
		'/api/auth/send-reset-code',
		'/api/auth/reset-password',
	],

	/** API GET 公开的路径（写操作仍需认证） */
	API_PUBLIC_PATHS: [
		'/api/version',
		'/api/readme-ai',
		'/api/readme-ai/init',
		'/api/readme-ai/rewrite',
		'/api/wiki/pages',
		'/api/wiki/pages/search',
		'/api/wiki/categories',
		'/api/wiki/categories/tree',
		'/api/wiki/tags',
		'/api/wiki/templates',
	],

	/** API GET 公开的路径前缀（写操作仍需认证） */
	API_PUBLIC_PREFIXES: [
		'/api/wiki/special',
		'/api/wiki/pages/',
		'/api/wiki/categories/',
		'/api/wiki/tags/',
		'/api/wiki/templates/',
	],

	/** 资源文件前缀 */
	ASSET_PREFIXES: ['/_astro'],
} as const

/**
 * 判断是否为公开页面路径
 */
export const isPublicPath = (pathname: string): boolean => {
	if (RouteConfig.PUBLIC_PATHS.has(pathname)) {
		return true
	}

	return RouteConfig.PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

/**
 * 判断是否为静态资源路径
 */
export const isAssetPath = (pathname: string): boolean => {
	if (RouteConfig.ASSET_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
		return true
	}

	// 包含文件扩展名的视为资源文件
	return pathname.includes('.')
}

/**
 * 判断 API 路径是否需要认证
 * API_UNRESTRICTED_PATHS 中的路径始终公开（所有方法，如登录/注册）
 * API_PUBLIC_PATHS / API_PUBLIC_PREFIXES 中的路径仅 GET/HEAD/OPTIONS 公开
 */
export const isApiPublicPath = (pathname: string, method?: string): boolean => {
	// 登录/注册等接口，所有方法都公开
	const unrestricted = RouteConfig.API_UNRESTRICTED_PATHS.some(
		(path) => pathname === path || pathname.startsWith(`${path}/`),
	)
	if (unrestricted) {
		return true
	}

	// 写操作（POST/PUT/PATCH/DELETE）需要认证
	if (method && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
		return false
	}

	// GET 请求检查公开路径匹配
	const exactMatch = RouteConfig.API_PUBLIC_PATHS.some(
		(path) => pathname === path || pathname.startsWith(`${path}/`),
	)
	const prefixMatch = RouteConfig.API_PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))

	return exactMatch || prefixMatch
}
