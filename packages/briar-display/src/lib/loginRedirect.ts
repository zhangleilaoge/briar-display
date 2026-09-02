/**
 * 登录回跳工具：登录成功后优先回到触发登录跳转之前的页面
 */

/** 认证类页面（自身不作为回跳目标，避免登录后又跳回登录页） */
const AUTH_PAGE_PREFIXES = ['/briar/login', '/briar/register', '/briar/forgot-password']

/** 生成登录页地址，并把当前页面作为 redirect 回跳目标带上 */
export const buildLoginUrl = () => {
	if (typeof window === 'undefined') return '/briar/login'

	const current = `${window.location.pathname}${window.location.search}`
	if (AUTH_PAGE_PREFIXES.some((prefix) => current.startsWith(prefix))) {
		return '/briar/login'
	}
	return `/briar/login?redirect=${encodeURIComponent(current)}`
}

/**
 * 读取登录页 URL 上的 redirect 参数作为登录成功后的落地页。
 * 仅放行站内路径（/ 开头且非 //），防止开放重定向。
 */
export const getSafeLoginRedirect = (fallback = '/briar/') => {
	if (typeof window === 'undefined') return fallback

	const redirect = new URLSearchParams(window.location.search).get('redirect')
	if (redirect?.startsWith('/') && !redirect.startsWith('//')) {
		return redirect
	}
	return fallback
}
