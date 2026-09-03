import type { MediaParseResult } from '@briar/shared'
import { A_BOGUS_UA, generateABogus } from '../lib/aBogus'

/**
 * 抖音自研解析（catsapi 抖音通道 2026-09 起持续 502，逆向 douyin.com web 端 detail 接口自研）：
 * 短链/分享页解析出 aweme_id → ttwid（游客凭证）+ a_bogus 签名 → web detail 接口取完整作品数据。
 * 视频：play_addr 即无水印地址；图集：images[].url_list；动态照片：images[].video.play_addr；音轨：music.play_url。
 */

const MOBILE_UA =
	'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const DETAIL_API = 'https://www.douyin.com/aweme/v1/web/aweme/detail/'
const TTWID_API = 'https://ttwid.bytedance.com/ttwid/union/register/'
const RESOLVE_TIMEOUT_MS = 15_000
const DETAIL_TIMEOUT_MS = 20_000

/** aweme_id 提取：video/note/slides（含 share/ 前缀路径） */
const AWEME_ID_RE = /\/(?:share\/)?(?:video|slides|note)\/(\d{6,25})/

/** detail 接口固定参数（字段顺序即签名顺序，勿动） */
const BASE_PARAMS: [string, string][] = [
	['device_platform', 'webapp'],
	['aid', '6383'],
	['channel', 'channel_pc_web'],
	['pc_client_type', '1'],
	['version_code', '290100'],
	['version_name', '29.1.0'],
	['cookie_enabled', 'true'],
	['screen_width', '1920'],
	['screen_height', '1080'],
	['browser_language', 'zh-CN'],
	['browser_platform', 'Win32'],
	['browser_name', 'Chrome'],
	['browser_version', '130.0.0.0'],
	['browser_online', 'true'],
	['engine_name', 'Blink'],
	['engine_version', '130.0.0.0'],
	['os_name', 'Windows'],
	['os_version', '10'],
	['cpu_core_num', '12'],
	['device_memory', '8'],
	['platform', 'PC'],
	['downlink', '10'],
	['effective_type', '4g'],
	['from_user_page', '1'],
	['locate_query', 'false'],
	['need_time_list', '1'],
	['pc_libra_divert', 'Windows'],
	['publish_video_strategy_type', '2'],
	['round_trip_time', '0'],
	['show_live_replay_strategy', '1'],
	['time_list_query', '0'],
	['whale_cut_token', ''],
	['update_version_code', '170400'],
	['msToken', ''],
]

/** ttwid 游客凭证（长效，进程内缓存；接口偶发下发失败时允许重取） */
let ttwidCache: string | null = null
let ttwidPromise: Promise<string | null> | null = null

async function fetchTtwid(): Promise<string | null> {
	try {
		const res = await fetch(TTWID_API, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'User-Agent': A_BOGUS_UA },
			body: JSON.stringify({
				region: 'cn',
				aid: 1768,
				needFid: false,
				service: 'www.ixigua.com',
				migrate_info: { ticket: '', source: 'node' },
				cbUrlProtocol: 'https',
				union: true,
			}),
			signal: AbortSignal.timeout(RESOLVE_TIMEOUT_MS),
		})
		const cookies: string[] =
			typeof res.headers.getSetCookie === 'function'
				? res.headers.getSetCookie()
				: [res.headers.get('set-cookie') || '']
		for (const cookie of cookies) {
			const match = cookie.match(/ttwid=([^;]+)/)
			if (match) return match[1]
		}
		return null
	} catch (err) {
		console.error('[Douyin] ttwid 获取失败:', err)
		return null
	}
}

/** 取 ttwid（并发去重）；force 时放弃缓存重取 */
function getTtwid(force = false): Promise<string | null> {
	if (!force && ttwidCache) return Promise.resolve(ttwidCache)
	if (!force && ttwidPromise) return ttwidPromise
	ttwidPromise = fetchTtwid()
		.then((value) => {
			if (value) ttwidCache = value
			return value
		})
		.finally(() => {
			ttwidPromise = null
		})
	return ttwidPromise
}

/** 从分享链接解析 aweme_id：直接 URL 正则提取；短链手动跟 302 取 Location */
async function resolveAwemeId(url: string): Promise<string> {
	const direct = url.match(AWEME_ID_RE)
	if (direct) return direct[1]

	let current = url
	for (let hop = 0; hop < 3; hop++) {
		const res = await fetch(current, {
			headers: { 'User-Agent': MOBILE_UA },
			redirect: 'manual',
			signal: AbortSignal.timeout(RESOLVE_TIMEOUT_MS),
		})
		// 个别情况下短链直接渲染而非 302，从最终 URL/页面里兜底找 id
		const location = res.headers.get('location')
		if (!location) {
			const html = res.status === 200 ? await res.text() : ''
			const inPage = html.match(AWEME_ID_RE) || html.match(/aweme_id["'=:\s]+(\d{6,25})/)
			if (inPage) return inPage[1]
			throw new Error('无法识别的抖音链接')
		}
		const match = location.match(AWEME_ID_RE)
		if (match) return match[1]
		// 已删除/过期的分享会跳抖音首页
		if (/^https?:\/\/(www\.)?douyin\.com\/?(\?|$)/.test(location)) {
			throw new Error('作品不存在或分享已失效')
		}
		if (/^https?:\/\//.test(location)) {
			current = location
			continue
		}
		throw new Error('无法识别的抖音链接')
	}
	throw new Error('作品不存在或分享已失效')
}

interface DouyinUrlList {
	url_list?: string[]
}

interface DouyinAwemeDetail {
	desc?: string
	aweme_type?: number
	author?: { nickname?: string; sec_uid?: string }
	video?: {
		play_addr?: DouyinUrlList
		cover?: DouyinUrlList
		origin_cover?: DouyinUrlList
	}
	images?: {
		url_list?: string[]
		video?: { play_addr?: DouyinUrlList }
	}[]
	music?: {
		title?: string
		play_url?: DouyinUrlList & { uri?: string }
	}
}

interface DouyinDetailResponse {
	aweme_detail?: DouyinAwemeDetail | null
	filter_detail?: { filter_reason?: string }
	status_code?: number
	status_msg?: string
}

const pickUrl = (list?: DouyinUrlList | null): string | null => {
	const url = list?.url_list?.find((u) => typeof u === 'string' && u.length > 0)
	return url ? url.replace(/^http:\/\//i, 'https://') : null
}

/** 构造带签名的 detail 请求 URL（query 顺序与签名输入逐字节一致） */
function buildDetailUrl(awemeId: string): string {
	const query = [...BASE_PARAMS, ['aweme_id', awemeId] as [string, string]]
		.map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
		.join('&')
	return `${DETAIL_API}?${query}&a_bogus=${encodeURIComponent(generateABogus(query))}`
}

async function fetchDetail(awemeId: string, ttwid: string | null): Promise<Response> {
	return fetch(buildDetailUrl(awemeId), {
		headers: {
			'User-Agent': A_BOGUS_UA,
			Referer: 'https://www.douyin.com/',
			Accept: 'application/json, text/plain, */*',
			...(ttwid ? { Cookie: `ttwid=${ttwid}` } : {}),
		},
		signal: AbortSignal.timeout(DETAIL_TIMEOUT_MS),
	})
}

/** detail 响应 → 通用解析结果（纯函数，便于测试） */
export function mapAwemeDetail(detail: DouyinAwemeDetail): MediaParseResult {
	const images = (detail.images || [])
		.map((img) => pickUrl({ url_list: img.url_list }))
		.filter((u): u is string => Boolean(u))
	const livePhotos = (detail.images || [])
		.map((img) => pickUrl(img.video?.play_addr))
		.filter((u): u is string => Boolean(u))
	const videoUrl = pickUrl(detail.video?.play_addr)
	const audioUrl = pickUrl(detail.music?.play_url)
	const cover =
		pickUrl(detail.video?.cover) || pickUrl(detail.video?.origin_cover) || images[0] || null

	return {
		platform: 'douyin',
		title: (detail.desc || '').trim(),
		author: detail.author?.nickname
			? { name: detail.author.nickname, uid: detail.author.sec_uid }
			: null,
		cover,
		video_url: videoUrl,
		audio_url: audioUrl,
		// 图集作品的 videos 恒为空（背景音乐进 audio_url，与前端「图文 videos 视为音轨」的兜底逻辑兼容）
		videos: videoUrl ? [videoUrl] : [],
		images,
		live_photos: livePhotos,
	}
}

/** 抖音分享链接 → 无水印媒体 */
export async function parseDouyin(url: string): Promise<MediaParseResult> {
	const awemeId = await resolveAwemeId(url)

	// Argus 风控按概率拦截（403 Uifid Not Found / 200 空 body），换 fresh ttwid 重试可过
	let text = ''
	let ok = false
	for (let attempt = 0; attempt < 3 && !ok; attempt++) {
		const ttwid = await getTtwid(attempt > 0)
		const res = await fetchDetail(awemeId, ttwid)
		text = await res.text()
		ok = res.ok && text.length > 0
		if (!ok) {
			console.error(
				`[Douyin] detail attempt ${attempt + 1} failed for ${awemeId}: HTTP ${res.status} ${text.slice(0, 120)}`,
			)
			if (attempt < 2) await new Promise((r) => setTimeout(r, 400 * (attempt + 1)))
		}
	}
	if (!ok) throw new Error('解析失败，请稍后重试')

	const data = JSON.parse(text) as DouyinDetailResponse
	const detail = data.aweme_detail
	if (!detail) {
		console.error(`[Douyin] detail filtered for ${awemeId}: ${text.slice(0, 200)}`)
		throw new Error('作品不存在、已删除或仅作者本人可见')
	}

	return mapAwemeDetail(detail)
}
