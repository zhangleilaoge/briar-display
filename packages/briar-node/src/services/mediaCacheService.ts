import { createHash } from 'node:crypto'
import { generateId } from '@briar/shared'
import type { MediaParseResult } from '@briar/shared'
import { execute, query, queryOne } from '../lib/db'
import { cosService } from './cosService'

/** 每人最多保留的解析记录数（与前端历史记录条数一致） */
export const PARSE_CACHE_MAX_PER_PERSON = 10
/** 媒体资源缓存保留天数（解析结果不受此限制，仅随 10 条上限淘汰） */
export const MEDIA_CACHE_MAX_AGE_DAYS = 7
/** 单条解析记录的媒体资源累计缓存上限：超过则该记录完全不走媒体缓存 */
export const MEDIA_CACHE_MAX_RECORD_BYTES = 50 * 1024 * 1024

/** sha256(源 CDN URL)，media_cache 的去重键 + COS 对象名 */
export const hashMediaUrl = (url: string) => createHash('sha256').update(url).digest('hex')

interface ParseCacheRow {
	id: string
	person: string
	url: string
	platform: string
	result: MediaParseResult | string
	stale: number
	updated_at: Date
}

/** 解析历史条目（登录用户跨设备互通） */
export interface MediaHistoryEntry {
	url: string
	title: string
	parsedAt: number
}

export interface MediaCacheRecord {
	id: string
	person: string
	parseUrl: string
	urlHash: string
	cosKey: string
	contentType: string
	size: number
}

interface MediaCacheRow {
	id: string
	person: string
	parse_url: string
	url_hash: string
	cos_key: string
	content_type: string
	size: number
}

const mapMediaRow = (row: MediaCacheRow): MediaCacheRecord => ({
	id: row.id,
	person: row.person,
	parseUrl: row.parse_url,
	urlHash: row.url_hash,
	cosKey: row.cos_key,
	contentType: row.content_type,
	size: row.size,
})

/** 批量删除 COS 公有桶对象（best effort，不抛错） */
const deleteCosObjects = async (keys: string[]) => {
	for (const key of keys) {
		try {
			await cosService.deletePublicObject(key)
		} catch (err) {
			console.error('[MediaCache] 删除 COS 对象失败:', key, err)
		}
	}
}

/** 批量删除解析记录及其媒体缓存（DB 行 + COS 对象），LRU 淘汰与手动删历史共用 */
const deleteParseRows = async (person: string, urls: string[]) => {
	if (urls.length === 0) return
	const placeholders = urls.map(() => '?').join(',')
	const mediaRows = await query<MediaCacheRow>(
		`SELECT cos_key FROM media_cache WHERE person = ? AND parse_url IN (${placeholders})`,
		[person, ...urls],
	)
	await execute(`DELETE FROM media_cache WHERE person = ? AND parse_url IN (${placeholders})`, [
		person,
		...urls,
	])
	await execute(`DELETE FROM media_parse_cache WHERE person = ? AND url IN (${placeholders})`, [
		person,
		...urls,
	])
	// COS 删除放最后，失败只记日志（DB 已清，7 天定时任务会兜底扫不掉这些——索性这里尽力删）
	await deleteCosObjects(mediaRows.map((r) => r.cos_key))
}

export const mediaCacheService = {
	/** 读解析缓存（mysql2 会自动把 JSON 列解析成对象）；stale=1（媒体地址已被上游拒绝）不命中；抖音签名 URL 时效很短（实测不足半小时），缓存超 10 分钟视为失效 */
	async getCachedParse(person: string, url: string): Promise<MediaParseResult | null> {
		const row = await queryOne<ParseCacheRow>(
			'SELECT platform, result, updated_at FROM media_parse_cache WHERE person = ? AND url = ? AND stale = 0',
			[person, url],
		)
		if (!row) return null
		if (
			row.platform === 'douyin' &&
			Date.now() - new Date(row.updated_at).getTime() > 10 * 60_000
		) {
			return null
		}
		const result = typeof row.result === 'string' ? JSON.parse(row.result) : row.result
		// xhs 旧格式媒体地址（catsapi 时代 webpic 时效签名路径 /{14位时间戳}/）过期即废；
		// 自研解析产出的裸 key 地址长效，不受影响
		if (row.platform === 'xhs') {
			const r = result as MediaParseResult
			const urls = [r.cover, r.video_url, r.audio_url, ...r.images, ...r.videos, ...r.live_photos]
			if (urls.some((u) => u && /xhscdn\.com\/\d{14}\//.test(u))) return null
		}
		return result as MediaParseResult
	},

	/**
	 * 标记解析缓存失效（媒体 URL 被上游 403 时调用）：行保留作历史记录，仅让 getCachedParse 不再命中，
	 * 「重新解析」会真正重新拉取新签名；COS 里已缓存的媒体副本仍有效，不动。
	 * updated_at 显式赋值自身：阻止 ON UPDATE CURRENT_TIMESTAMP 自动刷新，避免打乱 LRU/历史排序。
	 */
	async markParseStale(person: string, url: string): Promise<void> {
		await execute(
			'UPDATE media_parse_cache SET stale = 1, updated_at = updated_at WHERE person = ? AND url = ?',
			[person, url],
		)
	},

	/** 解析历史（最近 10 条，含 stale 已失效记录——点历史会触发重新解析拿到新签名） */
	async listParseHistory(person: string): Promise<MediaHistoryEntry[]> {
		const rows = await query<ParseCacheRow>(
			`SELECT url, result, updated_at FROM media_parse_cache WHERE person = ? ORDER BY updated_at DESC LIMIT ${PARSE_CACHE_MAX_PER_PERSON}`,
			[person],
		)
		return rows.map((row) => {
			const result = typeof row.result === 'string' ? JSON.parse(row.result) : row.result
			return {
				url: row.url,
				title: (result as MediaParseResult)?.title || '',
				parsedAt: new Date(row.updated_at).getTime(),
			}
		})
	},

	/** 删除解析历史（传 url 删单条，否则清空），连带清理对应媒体缓存 */
	async deleteParseHistory(person: string, url?: string): Promise<void> {
		const urls = url
			? [url]
			: (
					await query<{ url: string }>('SELECT url FROM media_parse_cache WHERE person = ?', [
						person,
					])
				).map((r) => r.url)
		await deleteParseRows(person, urls)
	},

	/**
	 * 写解析缓存（同链接覆盖并复位 stale），随后按 LRU 淘汰：每人最多 10 条，
	 * 超出的解析记录连同其媒体缓存（DB 行 + COS 对象）一起删掉。
	 */
	async saveCachedParse(
		person: string,
		url: string,
		platform: string,
		result: MediaParseResult,
	): Promise<void> {
		await execute(
			`INSERT INTO media_parse_cache (id, person, url, platform, result)
			 VALUES (?, ?, ?, ?, ?)
			 ON DUPLICATE KEY UPDATE platform = VALUES(platform), result = VALUES(result), stale = 0`,
			[generateId(), person, url, platform, JSON.stringify(result)],
		)
		// LIMIT/OFFSET 不能用绑定参数，条数是我们自己的常量，直接内联
		const overflow = await query<{ url: string }>(
			`SELECT url FROM media_parse_cache WHERE person = ? ORDER BY updated_at DESC LIMIT 100 OFFSET ${PARSE_CACHE_MAX_PER_PERSON}`,
			[person],
		)
		await deleteParseRows(
			person,
			overflow.map((r) => r.url),
		)
	},

	/** 查媒体缓存（命中时顺带更新 last_access_at，失败不阻塞） */
	async lookupMedia(person: string, urlHash: string): Promise<MediaCacheRecord | null> {
		const row = await queryOne<MediaCacheRow>(
			'SELECT * FROM media_cache WHERE person = ? AND url_hash = ?',
			[person, urlHash],
		)
		if (!row) return null
		execute('UPDATE media_cache SET last_access_at = NOW() WHERE id = ?', [row.id]).catch(() => {})
		return mapMediaRow(row)
	},

	/** 某条解析记录已缓存的媒体总字节数（配合 50MB 上限判定） */
	async sumRecordMediaSize(person: string, parseUrl: string): Promise<number> {
		const row = await queryOne<{ total: number | null }>(
			'SELECT SUM(size) AS total FROM media_cache WHERE person = ? AND parse_url = ?',
			[person, parseUrl],
		)
		return Number(row?.total || 0)
	},

	/** 媒体已传 COS 后落库（同 URL 重复缓存时覆盖） */
	async recordMedia(record: Omit<MediaCacheRecord, 'id'>): Promise<void> {
		await execute(
			`INSERT INTO media_cache (id, person, parse_url, url_hash, cos_key, content_type, size)
			 VALUES (?, ?, ?, ?, ?, ?, ?)
			 ON DUPLICATE KEY UPDATE cos_key = VALUES(cos_key), content_type = VALUES(content_type), size = VALUES(size)`,
			[
				generateId(),
				record.person,
				record.parseUrl,
				record.urlHash,
				record.cosKey,
				record.contentType,
				record.size,
			],
		)
	},

	/** 定时清理：删除超过 maxAgeDays 天的媒体缓存（DB 行 + COS 对象），返回清理条数 */
	async cleanupExpiredMedia(maxAgeDays = MEDIA_CACHE_MAX_AGE_DAYS): Promise<number> {
		// 天数是我们自己的常量（或任务入参），直接内联
		const rows = await query<MediaCacheRow>(
			`SELECT id, cos_key FROM media_cache WHERE created_at < DATE_SUB(NOW(), INTERVAL ${Math.floor(maxAgeDays)} DAY) LIMIT 500`,
		)
		if (rows.length === 0) return 0
		await execute(`DELETE FROM media_cache WHERE id IN (${rows.map(() => '?').join(',')})`, [
			...rows.map((r) => r.id),
		])
		await deleteCosObjects(rows.map((r) => r.cos_key))
		return rows.length
	},
}
