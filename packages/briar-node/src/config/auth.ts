import { loadEnv } from './env'

loadEnv()

export const AUTH_CONFIG = {
	jwtSecret: process.env.BRIAR_JWT_SECRET || 'briar_dev_secret',
	jwtExpiresIn: '7d',
} as const
