import { fileURLToPath } from 'url'
import type { SchedulerTask } from './scheduler'

const resolveCron = (envKey: string, fallbackCron: string) => {
	const raw = process.env[envKey]
	return raw && raw.trim().length > 0 ? raw : fallbackCron
}

export const schedulerTasks: SchedulerTask[] = [
	{
		name: 'cleanup-verification-codes',
		cron: resolveCron('BRIAR_CLEANUP_CODES_CRON', '0 0 * * *'),
		path: fileURLToPath(new URL('../jobs/cleanup-verification-codes.mjs', import.meta.url)),
	},
	{
		name: 'renew-certificates',
		cron: resolveCron('BRIAR_RENEW_CERT_CRON', '17 3 * * *'), // 每日 03:17 检查，临期 30 天内才续期
		runOnStart: false,
		path: fileURLToPath(new URL('../jobs/renew-certificates.mjs', import.meta.url)),
	},
]
