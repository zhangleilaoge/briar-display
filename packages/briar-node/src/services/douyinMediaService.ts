import type { MediaParseResult } from '@briar/shared'
import { generateABogus } from '../lib/aBogus'
import { genMsToken, genVerifyFp, webSign } from '../lib/webSign'

/**
 * 抖音自研解析：短链/分享页解析出 aweme_id → web 端 detail 接口取完整作品数据。
 * 视频：play_addr 即无水印地址；图集：images[].url_list；动态照片：images[].video.play_addr；音轨：music.play_url。
 *
 * 2026-10 风控升级后 detail 接口为签保护接口，请求须携带三层凭证（缺一则 403 Argus Uifid Not Found）：
 * 1. a_bogus：bdms.js v1.0.1.19 签名（lib/aBogus.ts），绑定 query 逐字节 + UA
 * 2. x-secsdk-web-signature：secsdk 策略签名（lib/webSign.ts），绑定 uifid + 整段 query + 秒级时间戳
 * 3. 访客 cookie jar：uifid（UIFID_TEMP/UIFID，只能由真实浏览器会话取得，配置 BRIAR_DOUYIN_COOKIE）
 *    + s_v_web_id（可本地伪造）+ ttwid（注册接口自取）
 */

/** 签名绑定的 UA：与请求参数 browser_version/engine_version 130 自洽（家族探测带 chrome） */
const DOUYIN_UA =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
const MOBILE_UA =
	'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const DETAIL_API = 'https://www.douyin.com/aweme/v1/web/aweme/detail/'
const TTWID_API = 'https://ttwid.bytedance.com/ttwid/union/register/'
const RESOLVE_TIMEOUT_MS = 15_000
const DETAIL_TIMEOUT_MS = 20_000

/** aweme_id 提取：video/note/slides（含 share/ 前缀路径） */
const AWEME_ID_RE = /\/(?:share\/)?(?:video|slides|note)\/(\d{6,25})/

/** detail 接口固定参数（签名按序列化后的 query 计算，顺序即线上顺序） */
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
]

interface DouyinVisitor {
	/** uifid 的原始 cookie 名（UIFID_TEMP / UIFID / uifid 等拼写） */
	cookieName: string
	value: string
	verifyFp: string
}

/** uifid 的全部可接受拼写（SDK 按此顺序取值） */
const UIFID_COOKIE_NAMES = ['uifid', 'uifid_temp', 'uifidtemp', 'UIFID', 'UIFID_TEMP', 'UIFIDTEMP']

/**
 * 访客身份：解析 BRIAR_DOUYIN_COOKIE（浏览器devtools 复制的 douyin.com cookie 串，
 * 至少含 UIFID_TEMP/UIFID，s_v_web_id 缺失时本地伪造一个）。uifid 无法计算获得，
 * 只能由真实浏览器会话签发；未配置则跳过 websign 层，签保护接口会被拒。
 */
function loadVisitor(): DouyinVisitor | null {
	const raw = process.env.BRIAR_DOUYIN_COOKIE?.trim()
	if (!raw) return null
	const cookies: [string, string][] = raw
		.split(';')
		.map((part) => part.trim())
		.filter(Boolean)
		.map((part) => {
			const eq = part.indexOf('=')
			return [part.slice(0, eq), part.slice(eq + 1)] as [string, string]
		})
	const uifidEntry = UIFID_COOKIE_NAMES.map(
		(name) => [name, cookies.find(([k]) => k === name)?.[1]] as const,
	).find((entry): entry is readonly [string, string] => Boolean(entry[1]))
	if (!uifidEntry) return null
	return {
		cookieName: uifidEntry[0],
		value: uifidEntry[1],
		verifyFp: cookies.find(([k]) => k === 's_v_web_id')?.[1] || genVerifyFp(),
	}
}

const visitor = loadVisitor()
if (!visitor) {
	console.warn(
		'[Douyin] 未配置 BRIAR_DOUYIN_COOKIE（需含 UIFID_TEMP/UIFID），签保护接口将被风控拒绝',
	)
}

/** ttwid 游客凭证（长效，进程内缓存；接口偶发下发失败时允许重取） */
let ttwidCache: string | null = null
let ttwidPromise: Promise<string | null> | null = null

async function fetchTtwid(): Promise<string | null> {
	try {
		const res = await fetch(TTWID_API, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'User-Agent': DOUYIN_UA },
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

/**
 * 构造带完整签名的 detail 请求：msToken（本地伪造即可）→ a_bogus（对业务参数序列签名）
 * → 追加 verifyFp/fp → websign（追加 uifid/timestamp，md5 整段 query）→ 最终 URL + 签名头。
 */
function buildDetailRequest(awemeId: string): { url: string; headers: Record<string, string> } {
	const pairs: [string, string][] = [
		...BASE_PARAMS,
		['aweme_id', awemeId],
		['msToken', genMsToken()],
	]
	const unsignedQuery = pairs.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
	const withBogus: [string, string][] = [
		...pairs,
		['a_bogus', generateABogus(unsignedQuery, DOUYIN_UA)],
	]
	if (!visitor) {
		const query = withBogus.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
		return { url: `${DETAIL_API}?${query}`, headers: {} }
	}
	const withVisitor: [string, string][] = [
		...withBogus,
		['verifyFp', visitor.verifyFp],
		['fp', visitor.verifyFp],
	]
	const { query, headers } = webSign(withVisitor, visitor.value)
	return { url: `${DETAIL_API}?${query}`, headers }
}

function fetchDetail(awemeId: string, ttwid: string | null): Promise<Response> {
	const { url, headers } = buildDetailRequest(awemeId)
	const cookieParts = [
		ttwid ? `ttwid=${ttwid}` : '',
		visitor ? `${visitor.cookieName}=${visitor.value}` : '',
		visitor ? `s_v_web_id=${visitor.verifyFp}` : '',
	].filter(Boolean)
	return fetch(url, {
		headers: {
			'User-Agent': DOUYIN_UA,
			Referer: 'https://www.douyin.com/',
			Accept: 'application/json, text/plain, */*',
			...(cookieParts.length ? { Cookie: cookieParts.join('; ') } : {}),
			...headers,
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

	// Argus 风控按概率拦截（403 Uifid/空 body）时换 fresh ttwid 重试可过
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
