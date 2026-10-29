import { fileURLToPath } from 'url'
import { logDal } from '../dal/logDal'
import { certificateService } from '../services/certificateService'
import { deploymentService } from '../services/deploymentService'
import { fileModerationService } from '../services/fileModerationService'
import { maintenanceService } from '../services/maintenanceService'
import { syncCsi300EtfScale } from '../services/market/csi300EtfService'
import { mediaCacheService } from '../services/mediaCacheService'
import type { SchedulerTask } from './scheduler'

const resolveCron = (envKey: string, fallbackCron: string) => {
	const raw = process.env[envKey]
	return raw && raw.trim().length > 0 ? raw : fallbackCron
}

const resolveDomain = () => process.env.CERTIFICATE_DOMAIN || 'xiaobuzi.cn'

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
			return result.skipped
				? {
						status: 'skipped',
						message: '证书尚未到期，已跳过',
						detail: { domain: resolveDomain() },
					}
				: { message: '证书续期成功', detail: { domain: resolveDomain() } }
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
			return { message: `扫描完成，清理 ${cleaned} 张被封禁图片`, detail: { cleaned } }
		},
	},
	{
		name: 'cleanup-request-logs',
		label: '清理请求日志',
		description: '删除 90 天前的请求日志（request_logs），控制表体积',
		scheduleText: '每日 02:37',
		cron: resolveCron('BRIAR_CLEANUP_LOGS_CRON', '37 2 * * *'),
		runOnStart: false,
		path: fileURLToPath(new URL('../jobs/cleanup-request-logs.mjs', import.meta.url)),
		run: async () => {
			const deleted = await logDal.cleanup(90)
			return {
				message: `已清理 90 天前的请求日志 ${deleted} 条`,
				detail: { deleted, retentionDays: 90 },
			}
		},
	},
	{
		name: 'cleanup-media-cache',
		label: '清理媒体缓存',
		description: '删除 7 天前的媒体解析缓存文件（media_cache + COS 公有桶对象）',
		scheduleText: '每日 05:23',
		cron: resolveCron('BRIAR_CLEANUP_MEDIA_CRON', '23 5 * * *'),
		runOnStart: false,
		path: fileURLToPath(new URL('../jobs/cleanup-media-cache.mjs', import.meta.url)),
		run: async () => {
			const deleted = await mediaCacheService.cleanupExpiredMedia()
			return { message: `已清理过期的媒体缓存 ${deleted} 条（含 COS 对象）`, detail: { deleted } }
		},
	},
	{
		name: 'sync-csi300-etf-scale',
		label: '沪深300ETF占比快照',
		description: '同步官方完整月份的四只头部沪深300ETF份额、单位/累计净值与指数流通市值',
		scheduleText: '每日 21:43',
		cron: resolveCron('BRIAR_CSI300_ETF_SCALE_CRON', '43 21 * * *'),
		runOnStart: false,
		path: fileURLToPath(new URL('../jobs/sync-csi300-etf-scale.mjs', import.meta.url)),
		run: syncCsi300EtfScale,
	},
	{
		name: 'sync-deploy-runs',
		label: '同步部署记录',
		description:
			'拉取 GitHub Actions / jsonl 部署记录；CDN 发布开始与失败时给管理员发站内信（成功不发）',
		scheduleText: '每分钟',
		cron: resolveCron('BRIAR_SYNC_DEPLOY_CRON', '* * * * *'),
		runOnStart: false,
		path: fileURLToPath(new URL('../jobs/sync-deploy-runs.mjs', import.meta.url)),
		run: async () => {
			const items = await deploymentService.listDeployRuns(30, { awaitFailureBackfill: true })
			return {
				message: `已同步 ${items.length} 条部署记录`,
				detail: { total: items.length },
			}
		},
	},
]
