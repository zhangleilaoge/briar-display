import type { MediaParseResult } from '@briar/shared'
import { fetchOutbound, hasOutboundProxy } from '../lib/outboundProxy'

const PH_UA =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
const FETCH_TIMEOUT_MS = 30_000

interface PhMediaDefinition {
	format?: string
	quality?: string | number | (string | number)[]
	videoUrl?: string
	/** true 时 videoUrl 是 /video/get_media 接口，需二次请求换 mp4 列表 */
	remote?: boolean
}

interface PhGetMediaItem {
	format?: string
	quality?: string | number
	height?: number
	videoUrl?: string
}

/**
 * 从页面 HTML 提取 var flashvars_xxx = {...} 的 JSON（平衡花括号扫描，字符串/转义感知；
 * 不能简单正则匹配结尾，对象内部可能嵌套任意层级的 {}）
 */
export const extractFlashvars = (html: string): Record<string, unknown> | null => {
	const m = /var flashvars_\d+\s*=\s*\{/.exec(html)
	if (!m) return null
	const start = m.index + m[0].length - 1
	let depth = 0
	let inString = false
	let quote = ''
	let escaped = false
	for (let i = start; i < html.length; i++) {
		const ch = html[i]
		if (escaped) {
			escaped = false
			continue
		}
		if (inString) {
			if (ch === '\\') escaped = true
			else if (ch === quote) inString = false
			continue
		}
		if (ch === '"' || ch === "'") {
			inString = true
			quote = ch
		} else if (ch === '{') {
			depth++
		} else if (ch === '}') {
			depth--
			if (depth === 0) {
				try {
					return JSON.parse(html.slice(start, i + 1)) as Record<string, unknown>
				} catch {
					return null
				}
			}
		}
	}
	return null
}

/** get_media 响应 → 按清晰度降序去重的 mp4 列表 */
export const pickMp4List = (items: PhGetMediaItem[]): { quality: number; url: string }[] => {
	const byQuality = new Map<number, string>()
	for (const item of items) {
		if (item?.format !== 'mp4' || !item.videoUrl) continue
		const quality = Number(item.quality) || item.height || 0
		if (quality > 0 && !byQuality.has(quality)) byQuality.set(quality, item.videoUrl)
	}
	return [...byQuality.entries()]
		.sort((a, b) => b[0] - a[0])
		.map(([quality, url]) => ({ quality, url }))
}

/** get_media 二次请求取渐进式 mp4 列表（绑定页面会话 Cookie + Referer；失败返回空，由调用方兜底报错） */
const fetchGetMedia = async (
	url: string,
	referer: string,
	cookie: string,
): Promise<{ quality: number; url: string }[]> => {
	const headers: Record<string, string> = { 'User-Agent': PH_UA, Referer: referer }
	if (cookie) headers.Cookie = cookie
	const res = await fetchOutbound(url, {
		headers,
		signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
	}).catch(() => null)
	if (!res?.ok) return []
	const items = (await res.json().catch(() => null)) as PhGetMediaItem[] | null
	return Array.isArray(items) ? pickMp4List(items) : []
}

/** JSON-LD VideoObject.author（上传者）；取不到不阻塞 */
const extractAuthor = (html: string): string | null =>
	/"author"\s*:\s*"([^"]{1,120})"/.exec(html)?.[1] || null

/**
 * 解析 Pornhub 视频：视频页 flashvars → mediaDefinitions。
 * mp4 走 get_media 接口换多档渐进式地址（phncdn 签名 URL，时效约 2h、绑定出口 IP，
 * 下载必须经后端代理走同一 BRIAR_MEDIA_OUTBOUND_PROXY 出口）；
 * 部分视频 get_media 返回空（付费/下载被禁，仅 HLS 流），直接报错。
 */
export const parsePornhub = async (input: string): Promise<MediaParseResult> => {
	const pageUrl = input.replace(/^http:\/\//i, 'https://')
	if (!/[?&]viewkey=[\w-]+/i.test(pageUrl)) throw new Error('无效的 Pornhub 链接')

	let res: Response
	try {
		res = await fetchOutbound(pageUrl, {
			headers: { 'User-Agent': PH_UA, 'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8' },
			signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
		})
	} catch (err) {
		console.error('Pornhub page fetch failed:', err)
		throw new Error(
			hasOutboundProxy()
				? 'Pornhub 访问失败（出站代理异常），请稍后重试'
				: 'Pornhub 访问失败：服务器需配置 BRIAR_MEDIA_OUTBOUND_PROXY 出站代理',
		)
	}
	if (res.status === 404) throw new Error('视频不存在或已被删除')
	if (!res.ok) throw new Error(`页面请求失败（HTTP ${res.status}），请稍后重试`)
	const html = await res.text()
	// 页面会话 Cookie 回带给 get_media（部分视频不带会返回空列表）
	const cookie = (res.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]).join('; ')

	const flashvars = extractFlashvars(html)
	if (!flashvars) throw new Error('页面解析失败（地区受限或页面结构变更）')
	// 注意字段是字符串 'true'/'false' 而非布尔值
	if (String(flashvars.video_unavailable) === 'true') throw new Error('视频不可用或已被删除')

	const defs = Array.isArray(flashvars.mediaDefinitions)
		? (flashvars.mediaDefinitions as PhMediaDefinition[])
		: []
	const mp4s: { quality: number; url: string }[] = []
	for (const def of defs) {
		if (def.format !== 'mp4' || !def.videoUrl) continue
		if (def.remote || def.videoUrl.includes('/video/get_media')) {
			mp4s.push(...(await fetchGetMedia(def.videoUrl, pageUrl, cookie)))
		} else {
			const quality = Number(def.quality) || 0
			if (quality > 0) mp4s.push({ quality, url: def.videoUrl })
		}
	}

	const byQuality = new Map<number, string>()
	for (const { quality, url } of mp4s) {
		if (!byQuality.has(quality)) byQuality.set(quality, url)
	}
	const videos = [...byQuality.entries()].sort((a, b) => b[0] - a[0]).map(([, url]) => url)
	if (videos.length === 0) {
		throw new Error('该视频未提供 MP4 下载（可能为付费内容或仅提供 HLS 流）')
	}

	const title =
		(typeof flashvars.video_title === 'string' && flashvars.video_title) ||
		/<meta property="og:title" content="([^"]{1,200})"/.exec(html)?.[1] ||
		'Pornhub 视频'
	const cover =
		typeof flashvars.image_url === 'string' && flashvars.image_url
			? flashvars.image_url.replace(/^http:\/\//i, 'https://')
			: null
	const author = extractAuthor(html)

	return {
		platform: 'pornhub',
		title,
		author: author ? { name: author } : null,
		cover,
		video_url: videos[0],
		audio_url: null,
		videos,
		images: [],
		live_photos: [],
	}
}
