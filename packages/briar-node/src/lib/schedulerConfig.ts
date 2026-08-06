import { fileURLToPath } from 'url'
import { certificateService } from '../services/certificateService'
import { fileModerationService } from '../services/fileModerationService'
import { maintenanceService } from '../services/maintenanceService'
import type { SchedulerTask } from './scheduler'

const resolveCron = (envKey: string, fallbackCron: string) => {
	const raw = process.env[envKey]
	return raw && raw.trim().length > 0 ? raw : fallbackCron
}

const resolveDomain = () => process.env.CERTIFICATE_DOMAIN || 'stardew.site'

/**
 * 定时任务注册表（唯一事实来源）。
 *
 * 新增任务：在此加一条注册 + src/jobs/ 下加对应 job 文件，
 * 管理后台「定时任务」卡片会自动出现该任务并支持手动触发（需提供 run）。
 */
export const schedulerTasks: SchedulerTask[] = [
	{
		name: 'cleanup-verification-codes',
		label: '清理验证码',
		description: '清空过期的登录/注册/重置密码验证码记录',
		scheduleText: '每日 00:00',
		cron: resolveCron('BRIAR_CLEANUP_CODES_CRON', '0 0 * * *'),
		path: fileURLToPath(new URL('../jobs/cleanup-verification-codes.mjs', import.meta.url)),
		run: async () => {
			await maintenanceService.clearAllVerificationCodes()
			return '验证码记录已清理'
		},
	},
	{
		name: 'renew-certificates',
		label: '证书续期',
		description: '临期 30 天内自动续期并部署 SSL 证书；手动触发为强制续期',
		scheduleText: '每日 03:17',
		cron: resolveCron('BRIAR_RENEW_CERT_CRON', '17 3 * * *'), // 每日 03:17 检查，临期 30 天内才续期
		runOnStart: false,
		path: fileURLToPath(new URL('../jobs/renew-certificates.mjs', import.meta.url)),
		run: async () => {
			const result = await certificateService.renewCertificate(resolveDomain(), true, 'manual')
			if (!result.success) throw new Error(result.error || '续期失败')
			return result.skipped ? '证书尚未到期，已跳过' : '证书续期成功'
		},
	},
	{
		name: 'scan-blocked-files',
		label: '封禁图片扫描',
		description: '扫描被腾讯封禁的图片，自动从图库移除并站内信通知用户',
		scheduleText: '每日 04:43',
		cron: resolveCron('BRIAR_SCAN_BLOCKED_CRON', '43 4 * * *'), // 每日 04:43 扫描被腾讯封禁的图片
		runOnStart: false,
		path: fileURLToPath(new URL('../jobs/scan-blocked-files.mjs', import.meta.url)),
		run: async () => {
			const cleaned = await fileModerationService.scanAndCleanBlockedImages()
			return `扫描完成，清理 ${cleaned} 张被封禁图片`
		},
	},
]
