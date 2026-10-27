/**
 * Reverie 主题：页面 → 风格映射的唯一事实来源。
 * - scrapbook：复古剪贴簿（门户首页、登录注册、个人中心、博客等「会客」类页面）
 * - arcane：奥术 HUD（工具箱、文件、行情、管理后台等检索 / 列表 / 数据类页面）
 */
export type ReverieTheme = 'scrapbook' | 'arcane'

const ARCANE_PREFIXES = [
	'/briar/tools',
	'/briar/files',
	'/briar/markets',
	'/briar/admin',
	'/briar/images',
]

export function themeForPath(pathname: string): ReverieTheme {
	return ARCANE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
		? 'arcane'
		: 'scrapbook'
}

export function themeClass(theme: ReverieTheme): string {
	return theme === 'arcane' ? 'theme-arcane' : 'theme-scrapbook'
}
