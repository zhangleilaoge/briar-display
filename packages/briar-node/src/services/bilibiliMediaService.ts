import type { MediaParseResult } from '@briar/shared'

const BILI_UA =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
const BILI_HEADERS = { 'User-Agent': BILI_UA, Referer: 'https://www.bilibili.com/' }
const FETCH_TIMEOUT_MS = 30_000

const VIEW_API = 'https://api.bilibili.com/x/web-interface/view'
const PLAYURL_API = 'https://api.bilibili.com/x/player/playurl'

interface BiliViewData {
	title: string
	pic: string
	owner?: { name?: string; mid?: number }
	pages?: { cid: number; page: number; part: string }[]
}

interface BiliPlayurlData {
	durl?: { url: string; backup_url?: string[] | null }[]
	dash?: {
		video?: { baseUrl?: string; base_url?: string; bandwidth?: number }[]
		audio?: { baseUrl?: string; base_url?: string; bandwidth?: number }[]
	}
}

/** b23.tv 短链跟随 302 拿最终地址（分享文案里常见 b23.tv/xxxx 或 b23.tv/BVxxx） */
const resolveShortLink = async (url: string): Promise<string> => {
	const res = await fetch(url, {
		headers: BILI_HEADERS,
		signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
		redirect: 'follow',
	})
	return res.url || url
}

/** 从 URL 提取 BV 号 / av 号（兼容 www/m 站路径与 b23.tv 跳转结果） */
const extractVideoId = (url: string): { bvid?: string; aid?: string } | null => {
	const bv = url.match(/BV[0-9A-Za-z]{10}/)
	if (bv) return { bvid: bv[0] }
	const av = url.match(/\/video\/av(\d+)/i) || url.match(/[?&]aid=(\d+)/)
	if (av) return { aid: av[1] }
	return null
}

const fetchJson = async <T>(url: string): Promise<{ code: number; message?: string; data?: T }> => {
	const res = await fetch(url, {
		headers: BILI_HEADERS,
		signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
	})
	if (!res.ok) throw new Error(`B站接口请求失败（HTTP ${res.status}），请稍后重试`)
	return (await res.json()) as { code: number; message?: string; data?: T }
}

/** playurl 取流：优先 html5 通道的 muxed mp4（免登录上限 720P，浏览器可直接播） */
const fetchMuxedMp4 = async (idQuery: string, cid: number): Promise<string | null> => {
	const { data } = await fetchJson<BiliPlayurlData>(
		`${PLAYURL_API}?${idQuery}&cid=${cid}&fnval=1&platform=html5&high_quality=1&type=mp4&qn=64`,
	)
	return data?.durl?.[0]?.url || null
}

/** 回退 DASH：视频/音频分离（1080P 档但预览无声），取各自带宽最大的一档 */
const fetchDash = async (
	idQuery: string,
	cid: number,
): Promise<{ video: string | null; audio: string | null }> => {
	const { data } = await fetchJson<BiliPlayurlData>(`${PLAYURL_API}?${idQuery}&cid=${cid}&fnval=16`)
	const pick = (list?: { baseUrl?: string; base_url?: string; bandwidth?: number }[]) =>
		[...(list || [])].sort((a, b) => (b.bandwidth || 0) - (a.bandwidth || 0))[0]
	const video = pick(data?.dash?.video)
	const audio = pick(data?.dash?.audio)
	return {
		video: video?.baseUrl || video?.base_url || null,
		audio: audio?.baseUrl || audio?.base_url || null,
	}
}

/**
 * 解析 B 站视频（自研，web 公开接口免登录）：
 * view 接口拿标题/UP主/封面/分 P 列表 → playurl 接口拿播放地址。
 * 签名播放地址时效约 30 天，解析缓存无需像抖音那样短时效处理。
 */
export const parseBilibili = async (input: string): Promise<MediaParseResult> => {
	const host = (() => {
		try {
			return new URL(input).hostname.toLowerCase()
		} catch {
			return ''
		}
	})()
	const url = host === 'b23.tv' || host.endsWith('.b23.tv') ? await resolveShortLink(input) : input

	const vid = extractVideoId(url)
	if (!vid) throw new Error('无效的B站视频链接')
	const idQuery = vid.bvid ? `bvid=${vid.bvid}` : `aid=${vid.aid}`

	const view = await fetchJson<BiliViewData>(`${VIEW_API}?${idQuery}`)
	if (view.code === -404) throw new Error('视频不存在或已被删除')
	if (view.code !== 0 || !view.data) throw new Error(view.message || '视频信息获取失败')

	const data = view.data
	const pages = data.pages || []
	// 分 P：URL 带 ?p=N 时取对应分集，否则默认第 1 集
	let pageNo = 1
	try {
		pageNo = Math.max(1, Number(new URL(url).searchParams.get('p')) || 1)
	} catch {
		// 保持默认
	}
	const page = pages.find((p) => p.page === pageNo) || pages[0]
	if (!page) throw new Error('视频信息获取失败（无分集数据）')

	let videos: string[] = []
	let audioUrl: string | null = null
	const muxed = await fetchMuxedMp4(idQuery, page.cid).catch(() => null)
	if (muxed) {
		videos = [muxed]
	} else {
		// html5 通道偶尔无 durl（如部分版权/新编码视频），回退 DASH
		const dash = await fetchDash(idQuery, page.cid)
		if (dash.video) videos = [dash.video]
		audioUrl = dash.audio
	}

	const title =
		pages.length > 1 && page.part ? `${data.title}（P${page.page} ${page.part}）` : data.title

	return {
		platform: 'bilibili',
		title,
		author: data.owner?.name ? { name: data.owner.name, uid: String(data.owner.mid || '') } : null,
		cover: data.pic ? data.pic.replace(/^http:\/\//i, 'https://') : null,
		video_url: videos[0] || null,
		audio_url: audioUrl,
		videos,
		images: [],
		live_photos: [],
	}
}
