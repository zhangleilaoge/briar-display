import type { MediaParseResult } from '@briar/shared'

const XHS_UA =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
const FETCH_TIMEOUT_MS = 30_000

interface XhsStream {
	masterUrl?: string
	qualityType?: string
}

interface XhsImage {
	urlDefault?: string
	urlPre?: string
	url?: string
	livePhoto?: boolean
	/** 实况图的视频流：按编码分组（h264 基本恒有） */
	stream?: Record<string, XhsStream[]>
}

interface XhsNote {
	noteId?: string
	title?: string
	/** normal = 图文，video = 视频 */
	type?: string
	imageList?: XhsImage[]
	video?: { media?: { stream?: Record<string, XhsStream[]> } }
	user?: { nickname?: string; userId?: string }
}

interface XhsInitialState {
	note?: { noteDetailMap?: Record<string, { note?: XhsNote }> }
}

/** 笔记 ID：/explore/{id} 或老路径 /discovery/item/{id} */
const extractNoteId = (url: string) =>
	url.match(/\/(?:explore|discovery\/item)\/([0-9a-f]{24})/)?.[1]

/** 统一成 /explore/{id}?xsec_token=...（老路径 discovery/item 会 302 到信息流丢失笔记，必须改写） */
const normalizeNoteUrl = (url: string): string | null => {
	const id = extractNoteId(url)
	if (!id) return null
	let token = ''
	try {
		token = new URL(url).searchParams.get('xsec_token') || ''
	} catch {
		// 保持空
	}
	return `https://www.xiaohongshu.com/explore/${id}${token ? `?xsec_token=${encodeURIComponent(token)}` : ''}`
}

/**
 * xhslink 短链解析：手动跟 302（不能用 redirect:follow——中间态 discovery/item 老路径
 * 会继续 302 到 /explore 信息流，最终 URL 丢失笔记 ID），拿到第一个含笔记 ID 的 Location 即停；
 * 全程没有笔记 ID（如跳到裸首页）说明短链已失效/笔记已删
 */
const resolveShareUrl = async (url: string): Promise<string> => {
	const host = (() => {
		try {
			return new URL(url).hostname.toLowerCase()
		} catch {
			return ''
		}
	})()
	if (!host.includes('xhslink.')) return normalizeNoteUrl(url) || url

	let current = url
	for (let i = 0; i < 5; i++) {
		const res = await fetch(current, {
			headers: { 'User-Agent': XHS_UA, Accept: 'text/html,application/xhtml+xml' },
			signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
			redirect: 'manual',
		})
		res.body?.cancel()
		const location = res.headers.get('location')
		if (res.status < 300 || res.status >= 400 || !location) break
		const absolute = new URL(location, current).href
		const normalized = normalizeNoteUrl(absolute)
		if (normalized) return normalized
		current = absolute
	}
	throw new Error('链接已失效或笔记已被删除')
}

/**
 * 抠页面内嵌的 window.__INITIAL_STATE__ JSON。
 * 里面有裸 undefined 字面量（非法 JSON），按 JSON 值位置替换成 null 再 parse
 */
const extractInitialState = (html: string): XhsInitialState | null => {
	const marker = 'window.__INITIAL_STATE__='
	const start = html.indexOf(marker)
	if (start < 0) return null
	const rest = html.slice(start + marker.length)
	const end = rest.indexOf('</script>')
	const raw = (end >= 0 ? rest.slice(0, end) : rest).trim()
	try {
		return JSON.parse(raw.replace(/([:\[,])\s*undefined/g, '$1null')) as XhsInitialState
	} catch {
		return null
	}
}

/** 流里挑一条：优先 HD 档，编码按兼容性排序（h264 必能播） */
const pickStream = (stream?: Record<string, XhsStream[]>): string | null => {
	if (!stream) return null
	for (const codec of ['h264', 'h265', 'av1', 'h266']) {
		const list = stream[codec]
		if (!list?.length) continue
		const best = list.find((s) => s.qualityType === 'HD' && s.masterUrl) || list[0]
		if (best?.masterUrl) return best.masterUrl
	}
	return null
}

const pickImageUrl = (img: XhsImage): string | null =>
	img.urlDefault || img.urlPre || img.url || null

/**
 * 小红书自研解析（catsapi 的兜底）：短链跟 302 → GET 笔记页 HTML → __INITIAL_STATE__ 直出全部媒体。
 * 硬门槛是 xsec_token（短链跳转自带）；不带 token 会被拦到安全页（error 300031）。
 * 媒体地址都是 xhscdn.com 的 http 链接，由前端/代理统一升级 https。
 */
export const parseXhs = async (input: string): Promise<MediaParseResult> => {
	const url = await resolveShareUrl(input)
	const noteId = extractNoteId(url)
	if (!noteId) throw new Error('无效的小红书笔记链接')

	const res = await fetch(url, {
		headers: { 'User-Agent': XHS_UA, Accept: 'text/html,application/xhtml+xml' },
		signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
		redirect: 'follow',
	})
	if (!res.ok) throw new Error(`笔记页抓取失败（HTTP ${res.status}），请稍后重试`)
	const html = await res.text()

	const state = extractInitialState(html)
	const detailMap = state?.note?.noteDetailMap
	if (!detailMap) {
		// 风控安全页（300031）/ 登录墙都拿不到 noteDetailMap
		throw new Error('笔记解析失败（链接失效或触发小红书风控），请稍后重试')
	}
	const entries = Object.values(detailMap).filter((e) => e.note)
	const note = (entries.find((e) => e.note?.noteId === noteId) || entries[0])?.note
	if (!note || Object.keys(note).length === 0) {
		// 受限内容页 noteDetailMap 有键但 note 是空对象（undertake_note_error=该内容暂时无法查看）
		throw new Error('该笔记暂时无法查看（内容受平台限制或已被删除）')
	}

	const imageList = note.imageList || []
	const images = imageList.map(pickImageUrl).filter((u): u is string => Boolean(u))
	// 实况图：livePhoto 标记 + stream 里的视频流
	const livePhotos = imageList
		.filter((img) => img.livePhoto)
		.map((img) => pickStream(img.stream))
		.filter((u): u is string => Boolean(u))

	let videos: string[] = []
	if (note.type === 'video') {
		const videoUrl = pickStream(note.video?.media?.stream)
		if (videoUrl) videos = [videoUrl]
	}

	return {
		platform: 'xiaohongshu',
		title: note.title || '',
		author: note.user?.nickname
			? { name: note.user.nickname, uid: note.user.userId || undefined }
			: null,
		cover: images[0] || null,
		video_url: videos[0] || null,
		audio_url: null,
		videos,
		// 视频笔记的 imageList 是封面帧，不当图集返回
		images: note.type === 'video' ? [] : images,
		live_photos: livePhotos,
	}
}
