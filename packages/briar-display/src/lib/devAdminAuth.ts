import { clearAuthToken, isTokenUsable, login, setAuthToken } from '@/api/auth'

const loginDevAdmin = async (): Promise<boolean> => {
	clearAuthToken()
	const email = import.meta.env.BRIAR_DEV_ADMIN_EMAIL as string | undefined
	const password = import.meta.env.BRIAR_DEV_ADMIN_PASSWORD as string | undefined
	if (!email || !password) return false

	try {
		const result = await login({ email, password })
		if (!result.success || !result.data) {
			console.warn('[dev] 管理员自动登录失败，请检查本地 API 与私有管理员凭据。')
			return false
		}
		setAuthToken(result.data.token, result.data.user, result.data.permissions)
		return true
	} catch {
		console.warn('[dev] 管理员自动登录失败，请检查本地 API 与私有管理员凭据。')
		return false
	}
}

let loginAttempt: Promise<boolean> | null = null

export const ensureDevAdminSession = (): Promise<boolean> => {
	if (!import.meta.env.DEV || isTokenUsable()) return Promise.resolve(true)
	loginAttempt ??= loginDevAdmin()
	return loginAttempt
}
