import { loadEnv } from './env'

loadEnv()

export const AUTH_CONFIG = {
	jwtSecret: process.env.BRIAR_JWT_SECRET || 'briar_dev_secret',
	jwtExpiresIn: '7d',
	/** Google OAuth Web 客户端（未配置时「使用 Google 登录」返回 503） */
	googleClientId: process.env.BRIAR_GOOGLE_CLIENT_ID || '',
	googleClientSecret: process.env.BRIAR_GOOGLE_CLIENT_SECRET || '',
	/**
	 * 授权回调地址，须与 Google Cloud Console「已授权的重定向 URI」完全一致。
	 * 生产默认 https://xiaobuzi.cn/api/auth/google/callback；本地可设
	 * http://localhost:3888/api/auth/google/callback
	 */
	googleRedirectUri:
		process.env.BRIAR_GOOGLE_REDIRECT_URI || 'https://xiaobuzi.cn/api/auth/google/callback',
} as const

export const isGoogleAuthConfigured = () =>
	Boolean(AUTH_CONFIG.googleClientId && AUTH_CONFIG.googleClientSecret)
