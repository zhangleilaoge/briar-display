import type { MediaParseResult } from '@briar/shared'

export type MediaKind = 'cover' | 'video' | 'image' | 'live' | 'audio'

export interface MediaItem {
	id: string
	kind: MediaKind
	/** https 升级后的 CDN 地址 */
	url: string
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

/** 把上游解析结果整理成按类型分组的下载项 */
export const buildMediaSections = (result: MediaParseResult): MediaSections => {
	const base = sanitizeFilename(result.title || result.platform || 'xhs-media')
	const toItem = (kind: MediaKind, url: string, index: number, label: string): MediaItem => ({
		id: `${kind}-${index}-${url}`,
		kind,
		url: upgradeToHttps(url),
		label,
		filename: `${base}-${label.replace(/\s/g, '')}.${resolveExt(url, kind)}`,
	})

	// videos 去重（上游 video_url 常与会重复出现在 videos 里）
	const videoUrls = [...new Set(result.videos || [])].filter(Boolean)
	return {
		cover: result.cover ? toItem('cover', result.cover, 0, '封面') : null,
		videos: videoUrls.map((url, i) =>
			toItem('video', url, i, `视频${videoUrls.length > 1 ? pad(i + 1) : ''}`),
		),
		images: (result.images || [])
			.filter(Boolean)
			.map((url, i) => toItem('image', url, i, `原图${pad(i + 1)}`)),
		livePhotos: (result.live_photos || [])
			.filter(Boolean)
			.map((url, i) => toItem('live', url, i, `动态照片${pad(i + 1)}`)),
		audio: result.audio_url ? toItem('audio', result.audio_url, 0, '音轨') : null,
	}
}

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
