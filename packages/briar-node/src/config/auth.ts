import { loadEnv } from './env'

loadEnv()

export const AUTH_CONFIG = {
	jwtSecret: process.env.BRIAR_JWT_SECRET || 'briar_dev_secret',
	jwtExpiresIn: '7d',
	/**
	 * Google OAuth Web 客户端 ID（GIS 前端登录 + 后端校验 ID Token 的 aud）。
	 * Client ID 是公开值；未配置时回落到生产客户端，Google 登录接口不再需要 Client Secret。
	 */
	googleClientId:
		process.env.BRIAR_GOOGLE_CLIENT_ID ||
		'474345035956-al2lp1r93u9h9b543klodu0n4fu81ac4.apps.googleusercontent.com',
} as const

export const isGoogleAuthConfigured = () => Boolean(AUTH_CONFIG.googleClientId)
