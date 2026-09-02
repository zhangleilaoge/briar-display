import { getApiBaseUrl } from '@/api/request'
import douyinIcon from '@/assets/platforms/douyin.png'
import wechatIcon from '@/assets/platforms/wechat.png'
import xIcon from '@/assets/platforms/x.png'
import xiaohongshuIcon from '@/assets/platforms/xiaohongshu.png'
import type { MediaParseResult } from '@briar/shared'

export type MediaKind = 'cover' | 'video' | 'image' | 'live' | 'audio'

export interface MediaItem {
	id: string
	kind: MediaKind
	/** https 升级后的 CDN 地址 */
	url: string
	/** 需要后端代理才能预览的地址（如公众号实况图，auth 参数绑定微信 Cookie，直连 403） */
	previewUrl?: string
	/** 来源解析链接（服务端媒体缓存按它做 10 条淘汰 + 50MB 上限） */
	sourceUrl: string
	label: string
	filename: string
}

export interface MediaSections {
	cover: MediaItem | null
	videos: MediaItem[]
	images: MediaItem[]
	livePhotos: MediaItem[]
	audio: MediaItem | null
}

const PLATFORM_LABELS: Record<string, string> = {
	xiaohongshu: '小红书',
	douyin: '抖音',
	wechat: '微信公众号',
	x: 'X',
}

export const platformLabel = (platform: string) => PLATFORM_LABELS[platform] || platform

const PLATFORM_ICONS: Record<string, string> = {
	xiaohongshu: xiaohongshuIcon.src,
	douyin: douyinIcon.src,
	wechat: wechatIcon.src,
	x: xIcon.src,
}

/** 平台 favicon（取自官网 favicon，本地资源避免跨域/防盗链问题） */
export const platformIcon = (platform: string) => PLATFORM_ICONS[platform]

/** 从链接推断平台（历史记录未存平台字段，按 URL 推导） */
export const platformFromUrl = (url: string) => {
	if (url.includes('mp.weixin.qq.com')) return 'wechat'
	if (url.includes('douyin.com') || url.includes('iesdouyin.com')) return 'douyin'
	if (url.includes('x.com') || url.includes('twitter.com')) return 'x'
	return 'xiaohongshu'
}

/** 小红书 CDN 多为 http 链接，页面在 https 下需升级，否则被浏览器拦截 */
export const upgradeToHttps = (url: string) => url.replace(/^http:\/\//i, 'https://')

/** 文件名清洗：去掉非法字符、限长 */
export const sanitizeFilename = (name: string, maxLength = 60) => {
	const cleaned = name
		.replace(/[\\/:*?"<>|\s]+/g, '_')
		.replace(/_+/g, '_')
		.replace(/^_+|_+$/g, '')
	return (cleaned || 'media').slice(0, maxLength)
}

/** 从 CDN URL 推断扩展名，推断不出按媒体类型兜底 */
const resolveExt = (url: string, kind: MediaKind) => {
	const match = upgradeToHttps(url).match(/\.(mp4|mov|jpg|jpeg|png|webp|mp3|m4a)(?:[?/!]|$)/i)
	if (match) return match[1].toLowerCase().replace('jpeg', 'jpg')
	if (kind === 'video' || kind === 'live') return 'mp4'
	if (kind === 'audio') return 'mp3'
	return 'jpg'
}

const pad = (n: number) => String(n).padStart(2, '0')

/** 抖音视频 CDN 域名（签名绑定解析方 IP，即咱们服务器，访客浏览器直连 403） */
const DOUYIN_VIDEO_HOST_SUFFIXES = ['.zjcdn.com', '.douyinvod.com']
/** X/Twitter 媒体 CDN：国内不可达，一律走后端代理（服务端经 CF Worker 中转 + 旁路缓存） */
const X_MEDIA_HOST_SUFFIXES = ['.twimg.com']

/**
 * 需要走后端代理预览（inline 模式）的情形：
 * - 图片/封面：一律走代理——<img> 全量加载，proxy 顺带旁路缓存到 COS，二次加载 302 直发
 * - qpic.cn 实况图/视频：auth 参数绑定文章页 Cookie，浏览器直连 403（服务端回带 Cookie）
 * - 抖音视频/音轨：URL 签名绑定解析方 IP，浏览器直连 403（服务端 IP 与解析一致）
 * - twimg（X）图片/视频：国内不可达，服务端经 CF Worker 中转换流
 */
const needsProxyPreview = (url: string, kind: MediaKind) => {
	try {
		if (kind === 'image' || kind === 'cover') return true
		const host = new URL(upgradeToHttps(url)).hostname
		if (host.endsWith('.qpic.cn')) return true
		if (X_MEDIA_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) return true
		if (
			(kind === 'video' || kind === 'live' || kind === 'audio') &&
			DOUYIN_VIDEO_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))
		) {
			return true
		}
		return false
	} catch {
		return false
	}
}

const toProxyPreviewUrl = (url: string, filename: string, sourceUrl: string) =>
	`${getApiBaseUrl()}/media/proxy?inline=1&url=${encodeURIComponent(upgradeToHttps(url))}&name=${encodeURIComponent(filename)}&from=${encodeURIComponent(sourceUrl)}`

/** 把上游解析结果整理成按类型分组的下载项；sourceUrl 为来源解析链接（媒体缓存归属用） */
export const buildMediaSections = (result: MediaParseResult, sourceUrl = ''): MediaSections => {
	const base = sanitizeFilename(result.title || result.platform || 'xhs-media')
	const toItem = (kind: MediaKind, url: string, index: number, label: string): MediaItem => {
		const httpsUrl = upgradeToHttps(url)
		const filename = `${base}-${label.replace(/\s/g, '')}.${resolveExt(url, kind)}`
		return {
			id: `${kind}-${index}-${url}`,
			kind,
			url: httpsUrl,
			previewUrl: needsProxyPreview(httpsUrl, kind)
				? toProxyPreviewUrl(httpsUrl, filename, sourceUrl)
				: undefined,
			sourceUrl,
			label,
			filename,
		}
	}

	// videos 去重（上游 video_url 常与会重复出现在 videos 里）
	const rawVideos = [...new Set(result.videos || [])].filter(Boolean)
	const imageUrls = (result.images || []).filter(Boolean)
	// 音频判定：
	// 1. URL 带音频后缀（mp3/m4a，如 ies-music/*.mp3）
	// 2. 抖音图文作品（images 非空）的 videos 一律是背景音乐——无后缀的 m4a 也中招，
	//    实测 audio/mp4 裸路径；视频作品 images 恒为空，不会误伤
	const isAudioLike = (url: string) => /\.(mp3|m4a)(?:[?/]|$)/i.test(upgradeToHttps(url))
	const douyinSlideshow = result.platform === 'douyin' && imageUrls.length > 0
	const isAudio = (url: string) => isAudioLike(url) || douyinSlideshow
	const videoUrls = rawVideos.filter((url) => !isAudio(url))
	const audioUrl = result.audio_url || rawVideos.find(isAudio) || null
	return {
		cover: result.cover ? toItem('cover', result.cover, 0, '封面') : null,
		videos: videoUrls.map((url, i) =>
			toItem('video', url, i, `视频${videoUrls.length > 1 ? pad(i + 1) : ''}`),
		),
		images: imageUrls.map((url, i) => toItem('image', url, i, `原图${pad(i + 1)}`)),
		livePhotos: (result.live_photos || [])
			.filter(Boolean)
			.map((url, i) => toItem('live', url, i, `动态照片${pad(i + 1)}`)),
		audio: audioUrl ? toItem('audio', audioUrl, 0, '音轨') : null,
	}
}

/** 从分享文案中提取第一个 URL（与后端提取逻辑一致） */
export const extractShareUrl = (text: string) => text.match(/https?:\/\/[^\s]+/)?.[0] ?? text.trim()

/** 触发浏览器保存 */
export const saveBlob = (blob: Blob, filename: string) => {
	const objectUrl = URL.createObjectURL(blob)
	const a = document.createElement('a')
	a.href = objectUrl
	a.download = filename
	document.body.appendChild(a)
	a.click()
	a.remove()
	setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000)
}

// ==================== 极简 ZIP（store 模式，媒体文件本身已压缩，无需再压） ====================

const CRC_TABLE = (() => {
	const table = new Uint32Array(256)
	for (let n = 0; n < 256; n++) {
		let c = n
		for (let k = 0; k < 8; k++) {
			c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
		}
		table[n] = c >>> 0
	}
	return table
})()

const crc32 = (data: Uint8Array) => {
	let crc = 0xffffffff
	for (let i = 0; i < data.length; i++) {
		crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8)
	}
	return (crc ^ 0xffffffff) >>> 0
}

export interface ZipEntry {
	name: string
	data: Uint8Array
}

/** 生成 store 模式 zip（无压缩），文件名按 UTF-8 写入 */
export const createZip = (entries: ZipEntry[]): Blob => {
	const encoder = new TextEncoder()
	const chunks: Uint8Array[] = []
	const central: Uint8Array[] = []
	let offset = 0

	for (const entry of entries) {
		const nameBytes = encoder.encode(entry.name)
		const crc = crc32(entry.data)
		const size = entry.data.length

		const local = new DataView(new ArrayBuffer(30))
		local.setUint32(0, 0x04034b50, true)
		local.setUint16(4, 20, true) // version needed
		local.setUint16(6, 0x0800, true) // UTF-8 文件名标志
		local.setUint16(8, 0, true) // store
		local.setUint32(14, crc, true)
		local.setUint32(18, size, true)
		local.setUint32(22, size, true)
		local.setUint16(26, nameBytes.length, true)
		chunks.push(new Uint8Array(local.buffer), nameBytes, entry.data)

		const header = new DataView(new ArrayBuffer(46))
		header.setUint32(0, 0x02014b50, true)
		header.setUint16(4, 20, true)
		header.setUint16(6, 20, true)
		header.setUint16(8, 0x0800, true)
		header.setUint16(10, 0, true)
		header.setUint32(16, crc, true)
		header.setUint32(20, size, true)
		header.setUint32(24, size, true)
		header.setUint16(28, nameBytes.length, true)
		header.setUint32(42, offset, true)
		central.push(new Uint8Array(header.buffer), nameBytes)

		offset += 30 + nameBytes.length + size
	}

	const centralSize = central.reduce((sum, c) => sum + c.length, 0)
	const end = new DataView(new ArrayBuffer(22))
	end.setUint32(0, 0x06054b50, true)
	end.setUint16(8, entries.length, true)
	end.setUint16(10, entries.length, true)
	end.setUint32(12, centralSize, true)
	end.setUint32(16, offset, true)

	return new Blob([...chunks, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' })
}

// ==================== 历史记录（localStorage，最近 10 条链接 + 标题） ====================

export interface MediaHistoryItem {
	url: string
	title: string
	parsedAt: number
}

export const MEDIA_HISTORY_KEY = 'briar:media-history'
export const MAX_MEDIA_HISTORY = 10

export const loadMediaHistory = (): MediaHistoryItem[] => {
	if (typeof window === 'undefined') return []
	try {
		const raw = localStorage.getItem(MEDIA_HISTORY_KEY)
		const list = raw ? JSON.parse(raw) : []
		return Array.isArray(list) ? list : []
	} catch {
		return []
	}
}

export const saveMediaHistory = (items: MediaHistoryItem[]) => {
	if (typeof window === 'undefined') return
	localStorage.setItem(MEDIA_HISTORY_KEY, JSON.stringify(items.slice(0, MAX_MEDIA_HISTORY)))
}

/** 追加/置顶一条历史（按 url 去重），返回截断后的新列表 */
export const pushMediaHistory = (
	list: MediaHistoryItem[],
	url: string,
	title: string,
): MediaHistoryItem[] =>
	[{ url, title, parsedAt: Date.now() }, ...list.filter((item) => item.url !== url)].slice(
		0,
		MAX_MEDIA_HISTORY,
	)
