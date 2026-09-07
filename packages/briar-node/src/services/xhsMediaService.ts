import type { MediaParseResult } from '@briar/shared'

const XHS_UA =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
const FETCH_TIMEOUT_MS = 30_000

/** a1 游客 Cookie 生成（逆向自官方 JS：毫秒时间戳 hex + 30 随机字符 + 固定段 + crc32，截 52 位） */
const A1_CHARSET = 'abcdefghijklmnopqrstuvwxyz1234567890'
const CRC32_TABLE = Array.from({ length: 256 }, (_, n) => {
	let c = n
	for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
	return c >>> 0
})
const crc32 = (input: string): number => {
	let c = 0xffffffff
	for (let i = 0; i < input.length; i++)
		c = CRC32_TABLE[(c ^ input.charCodeAt(i)) & 0xff] ^ (c >>> 8)
	return (c ^ 0xffffffff) >>> 0
}
const generateA1 = (): string => {
	let rand = ''
	for (let i = 0; i < 30; i++) rand += A1_CHARSET[Math.floor(Math.random() * A1_CHARSET.length)]
	const part = `${Date.now().toString(16)}${rand}50000`
	return (part + String(crc32(part))).slice(0, 52)
}

interface XhsStream {
	masterUrl?: string
	qualityType?: string
}

interface XhsImage {
	fileId?: string
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
	cover?: { fileId?: string }
	/** 桌面端页面是 nickname，移动端页面是 nickName */
	user?: { nickname?: string; nickName?: string; userId?: string }
}

interface XhsInitialState {
	/** 桌面端笔记页 */
	note?: { noteDetailMap?: Record<string, { note?: XhsNote }> }
	/** 移动端笔记页（网页端受限笔记在桌面端拿不到数据，移动端壳可以） */
	noteData?: { data?: { noteData?: XhsNote } }
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

/**
 * 图片地址：优先 fileId 裸 key + imageView2 转 jpg（实测无水印原图；url/urlDefault 等场景图带平台水印）。
 * 裸 key 在 sns-na/ci 域上免签名直出，imageView2 处理参数不参与签名校验
 */
const RAW_IMAGE_BASE = 'https://sns-na-i1.xhscdn.com'
const rawImageUrl = (fileId: string) => `${RAW_IMAGE_BASE}/${fileId}?imageView2/2/format/jpg`

const pickImageUrl = (img: XhsImage): string | null =>
	(img.fileId ? rawImageUrl(img.fileId) : null) || img.urlDefault || img.urlPre || img.url || null

const MOBILE_UA =
	'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

/** 可选：小红书网页登录 Cookie（.env 配 BRIAR_XHS_COOKIE）。网页端受限笔记（桌面壳空 note）带登录态大概率放行 */
const XHS_COOKIE = process.env.BRIAR_XHS_COOKIE || ''

/**
 * 抓笔记页 HTML；被风控拦到 /404/sec_ 安全页（概率性，按 IP+指纹打分）返回 null 让上层换 a1 重试。
 * 请求头越极简通过率越高：实测只带 UA + fresh a1 通过率最高，Accept/Accept-Language 等额外头反而提高拦截率
 */
const fetchNoteHtml = async (url: string, ua: string): Promise<string | null> => {
	const headers: Record<string, string> = {
		'User-Agent': ua,
		Cookie: XHS_COOKIE || `a1=${generateA1()}`,
	}
	const res = await fetch(url, {
		headers,
		signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
		redirect: 'follow',
	})
	if (!res.ok) throw new Error(`笔记页抓取失败（HTTP ${res.status}），请稍后重试`)
	if (res.url.includes('/404/sec_')) return null
	return res.text()
}

/** 桌面端 state → 笔记（noteDetailMap 里 noteId 匹配或第一条；空对象视为未命中） */
const pickDesktopNote = (state: XhsInitialState | null, noteId: string): XhsNote | null => {
	const detailMap = state?.note?.noteDetailMap
	if (!detailMap) return null
	const entries = Object.values(detailMap).filter((e) => e.note)
	const note = (entries.find((e) => e.note?.noteId === noteId) || entries[0])?.note
	// 受限内容页 noteDetailMap 有键但 note 是空对象（undertake_note_error=该内容暂时无法查看）
	return note && Object.keys(note).length > 0 ? note : null
}

/** 移动端 state → 笔记（结构在 noteData.data.noteData） */
const pickMobileNote = (state: XhsInitialState | null, noteId: string): XhsNote | null => {
	const note = state?.noteData?.data?.noteData
	if (!note || Object.keys(note).length === 0) return null
	// 移动端笔记页可能 302 回信息流/他笔记，核对 ID
	return !note.noteId || note.noteId === noteId ? note : null
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * 小红书自研解析（catsapi 的兜底）：短链手动跟 302 → GET 笔记页 HTML → __INITIAL_STATE__ 直出全部媒体。
 * 移动端 UA 优先（noteData.data.noteData）：网页端受限笔记（桌面壳 note 为空对象）移动端能出数据，
 * 普通图文/视频也都覆盖。笔记页被风控概率性拦到 /404/sec_ 安全页（按 IP+TLS 指纹打分，裸 Node fetch
 * 不带 Cookie 必拦），每次重试换 fresh a1 游客 Cookie 并递增间隔，3 次不过再换桌面端（noteDetailMap）兜底。
 * 硬门槛是 xsec_token（短链跳转自带，过期/缺失会被拦）；分享文案整段传入时会先抠出第一个 URL。
 */
export const parseXhs = async (input: string): Promise<MediaParseResult> => {
	const url = await resolveShareUrl(input.match(/https?:\/\/[^\s]+/)?.[0] || input)
	const noteId = extractNoteId(url)
	if (!noteId) throw new Error('无效的小红书笔记链接')

	let note: XhsNote | null = null
	for (let attempt = 0; attempt < 3 && !note; attempt++) {
		if (attempt > 0) await sleep(2000 + attempt * 1000)
		const html = await fetchNoteHtml(url, MOBILE_UA)
		if (html) note = pickMobileNote(extractInitialState(html), noteId)
	}
	if (!note) {
		await sleep(2000)
		const html = await fetchNoteHtml(url, XHS_UA)
		if (html) note = pickDesktopNote(extractInitialState(html), noteId)
	}
	if (!note) throw new Error('笔记解析失败（链接失效、内容受限或触发小红书风控），请稍后重试')

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
		author:
			note.user?.nickname || note.user?.nickName
				? {
						name: (note.user.nickname || note.user.nickName) as string,
						uid: note.user.userId || undefined,
					}
				: null,
		cover: (note.cover?.fileId ? rawImageUrl(note.cover.fileId) : null) || images[0] || null,
		video_url: videos[0] || null,
		audio_url: null,
		videos,
		// 视频笔记的 imageList 是封面帧，不当图集返回
		images: note.type === 'video' ? [] : images,
		live_photos: livePhotos,
	}
}
