import { loadEnv } from './env'

loadEnv()

export const DatabaseConfig = {
	host: process.env.BRIAR_DATABASE_HOST || 'localhost',
	port: Number(process.env.BRIAR_DATABASE_PORT) || 3306,
	user: process.env.BRIAR_DATABASE_USER || 'root',
	password: process.env.BRIAR_DATABASE_PASSWORD || '',
	database: 'briar_display',
	connectionLimit: 10,
	waitForConnections: true,
	queueLimit: 0,
} as const
