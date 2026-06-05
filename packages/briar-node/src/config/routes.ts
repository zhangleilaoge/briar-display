/**
 * 路由配置
 * 定义公共路径和需要认证的路径规则
 */

export const RouteConfig = {
	/** 完全公开的路径（前端页面） */
	PUBLIC_PATHS: new Set([
		'/briar-display/login',
		'/briar-display/register',
		'/briar-display/forgot-password',
	]),

	/** 公开的路径前缀 */
	PUBLIC_PREFIXES: ['/demo'],

	/** API 不需要认证的路径 */
	API_PUBLIC_PATHS: [
		'/api/auth/login',
		'/api/auth/register',
		'/api/auth/send-reset-code',
		'/api/auth/reset-password',
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

	/** API 不需要认证的路径前缀 */
	API_PUBLIC_PREFIXES: [
		'/api/wiki/special',
		'/api/wiki/pages/',
		'/api/wiki/categories/',
		'/api/wiki/tags/',
		'/api/wiki/templates/',
		'/api/logs',
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
 */
export const isApiPublicPath = (pathname: string): boolean => {
	// 检查精确路径匹配
	const exactMatch = RouteConfig.API_PUBLIC_PATHS.some(
		(path) => pathname === path || pathname.startsWith(`${path}/`),
	)

	// 检查前缀匹配
	const prefixMatch = RouteConfig.API_PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))

	return exactMatch || prefixMatch
}
