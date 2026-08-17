import { fileDal } from '../dal/fileDal'
import { messageDal } from '../dal/messageDal'
import { closePool } from '../lib/db'
import { cosService } from './cosService'

const CONCURRENCY = 5
const FETCH_TIMEOUT = 10_000

/**
 * 检测图片是否被腾讯封禁。
 * 私有读 bucket 下未签名 URL 恒返回 403，必须先签发签名 URL 再请求；
 * 签名 URL 正常返回 2xx/206，403/451 才视为封禁。404（对象已不存在）不视为封禁，避免误删。
 * 网络异常返回 false（下轮扫描再试）。
 */
async function isBlocked(url: string): Promise<boolean> {
	try {
		const controller = new AbortController()
		const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT)
		try {
			const res = await fetch(url, {
				headers: { Range: 'bytes=0-0' },
				signal: controller.signal,
			})
			if (res.status === 451 || res.status === 403) {
				const body = await res.text().catch(() => '')
				console.warn('[Moderation] 命中封禁响应:', {
					url,
					status: res.status,
					body: body.slice(0, 500),
				})
				return true
			}
			return false
		} finally {
			clearTimeout(timer)
		}
	} catch {
		return false
	}
}

export const fileModerationService = {
	/** 扫描全部图片，被封禁的删除记录并通知用户。返回清理数量。 */
	async scanAndCleanBlockedImages(): Promise<number> {
		const images = await fileDal.listAllImages()
		let cleaned = 0

		for (let i = 0; i < images.length; i += CONCURRENCY) {
			const batch = images.slice(i, i + CONCURRENCY)
			const results = await Promise.all(
				batch.map(async (file) => ({
					file,
					blocked: await isBlocked(cosService.getSignedUrl(file.filename)),
				})),
			)

			for (const { file, blocked } of results) {
				if (!blocked) continue

				await fileDal.adminDelete(file.id)
				await cosService.deleteFileWithCover(file.filename, file.mimeType)
				await messageDal.create({
					userId: file.userId,
					type: 'file_blocked',
					title: '图片因违规被封禁',
					content: `您上传的图片「${file.originalName}」因违反腾讯云内容规范已被封禁，系统已自动将其从图库中移除。如有疑问请联系管理员。`,
				})

				cleaned++
				console.warn('[Moderation] 已清理被封禁图片:', {
					fileId: file.id,
					userId: file.userId,
					name: file.originalName,
				})
			}
		}

		console.log(`[Moderation] 扫描完成: 共 ${images.length} 张图片，清理 ${cleaned} 张`)
		return cleaned
	},

	/** 关闭数据库连接池（定时任务退出前调用，否则 mysql 连接会让进程无法退出） */
	async close(): Promise<void> {
		await closePool()
	},
}
