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

const pickImageUrl = (img: XhsImage): string | null =>
	img.urlDefault || img.urlPre || img.url || null

const MOBILE_UA =
	'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

/** 可选：小红书网页登录 Cookie（.env 配 BRIAR_XHS_COOKIE）。网页端受限笔记（桌面壳空 note）带登录态大概率放行 */
const XHS_COOKIE = process.env.BRIAR_XHS_COOKIE || ''

const fetchNoteHtml = async (url: string, ua: string): Promise<string> => {
	const headers: Record<string, string> = {
		'User-Agent': ua,
		Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
		// 风控对请求头指纹敏感，补全浏览器常见头降低概率性拦截
		'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
	}
	if (XHS_COOKIE) headers.Cookie = XHS_COOKIE
	const res = await fetch(url, {
		headers,
		signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
		redirect: 'follow',
	})
	if (!res.ok) throw new Error(`笔记页抓取失败（HTTP ${res.status}），请稍后重试`)
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

/**
 * 小红书自研解析（catsapi 的兜底）：短链手动跟 302 → GET 笔记页 HTML → __INITIAL_STATE__ 直出全部媒体。
 * 移动端 UA 优先（noteData.data.noteData）：网页端受限笔记（桌面壳 note 为空对象）移动端能出数据，
 * 普通图文/视频也都覆盖；被按 IP 概率风控（拦到 /404/sec_ 页）时隔 2s 换桌面端（noteDetailMap）兜底。
 * 硬门槛是 xsec_token（短链跳转自带）；不带 token 会被拦到安全页（error 300031）。
 * 媒体地址都是 xhscdn.com 的 http 链接，由前端/代理统一升级 https。
 */
export const parseXhs = async (input: string): Promise<MediaParseResult> => {
	const url = await resolveShareUrl(input)
	const noteId = extractNoteId(url)
	if (!noteId) throw new Error('无效的小红书笔记链接')

	let note = pickMobileNote(extractInitialState(await fetchNoteHtml(url, MOBILE_UA)), noteId)
	if (!note) {
		// 移动端被拦：笔记页接口按 IP 限频，连续两发必有一发被拦，隔 2s 再试桌面端
		await new Promise((r) => setTimeout(r, 2000))
		note = pickDesktopNote(extractInitialState(await fetchNoteHtml(url, XHS_UA)), noteId)
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
		cover: images[0] || null,
		video_url: videos[0] || null,
		audio_url: null,
		videos,
		// 视频笔记的 imageList 是封面帧，不当图集返回
		images: note.type === 'video' ? [] : images,
		live_photos: livePhotos,
	}
}
