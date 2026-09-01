import type { MediaParseResult } from '@briar/shared'

const WX_UA =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
const FETCH_TIMEOUT_MS = 30_000
/** 单篇文章最多提取的视频数（每个都要二次请求播放地址接口） */
const MAX_VIDEOS = 5

/**
 * 文章页下发的 Cookie：实况图（bcvideo.qpic.cn）的 auth 参数绑定该 Cookie 且短时有效，
 * 下载/预览时需回带，否则 403
 */
let cookieJar: { header: string; expiresAt: number } | null = null
const COOKIE_TTL_MS = 10 * 60_000

export const getWechatCookieHeader = (): string | null =>
	cookieJar && cookieJar.expiresAt > Date.now() ? cookieJar.header : null

/** 微信 HTML/JS 里的 URL 转义还原（\x26amp; → &） */
const decodeWxUrl = (url: string) =>
	url
		.replace(/\\x26amp;/g, '&')
		.replace(/&amp;/g, '&')
		.trim()

const decodeHtmlEntities = (text: string) =>
	text
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")

const upgradeToHttps = (url: string) => url.replace(/^http:\/\//i, 'https://')

/** 提取 og:meta */
const pickMetaContent = (html: string, property: string) => {
	const match = html.match(new RegExp(`property="${property}" content="([^"]*)"`))
	return match ? decodeHtmlEntities(match[1]) : null
}

/** 公众号名：图片消息在 <meta name="author">，图文在 var nickname / js_name */
const pickAuthor = (html: string) => {
	const match =
		html.match(/name="author" content="([^"]*)"/) ||
		html.match(/property="og:article:author" content="([^"]*)"/) ||
		html.match(/var nickname\s*=\s*(?:"([^"]*)"|'([^']*)')/) ||
		html.match(/id="js_name"[^>]*>\s*([^<]*?)\s*<\/span>/)
	const value = match ? match.slice(1).find(Boolean) : null
	return value ? decodeHtmlEntities(value) : null
}

/** 从 start 处提取平衡的 [...] 区域（跳过引号内字符），找不到返回 null */
const extractBalancedArray = (text: string, start: number): string | null => {
	const open = text.indexOf('[', start)
	if (open < 0) return null
	let depth = 0
	let quote: string | null = null
	for (let i = open; i < text.length; i++) {
		const ch = text[i]
		if (quote) {
			if (ch === quote && text[i - 1] !== '\\') quote = null
			continue
		}
		if (ch === "'" || ch === '"') {
			quote = ch
		} else if (ch === '[') {
			depth++
		} else if (ch === ']') {
			depth--
			if (depth === 0) return text.slice(open, i + 1)
		}
	}
	return null
}

/** 把 [...] 区域拆成顶层 {...} 项（引号感知），避免嵌套对象里的同名字段干扰 */
const splitTopLevelObjects = (region: string): string[] => {
	const entries: string[] = []
	let depth = 0
	let quote: string | null = null
	let start = -1
	for (let i = 0; i < region.length; i++) {
		const ch = region[i]
		if (quote) {
			if (ch === quote && region[i - 1] !== '\\') quote = null
			continue
		}
		if (ch === "'" || ch === '"') {
			quote = ch
		} else if (ch === '{') {
			if (depth === 0) start = i
			depth++
		} else if (ch === '}') {
			depth--
			if (depth === 0 && start >= 0) entries.push(region.slice(start, i + 1))
		}
	}
	return entries
}

/** 图片消息（picture post）：每项顶层 cdn_url 为静态原图，live_photo.format_info 为实况视频 */
const parsePicturePost = (html: string): { images: string[]; livePhotos: string[] } | null => {
	const marker = html.indexOf('picture_page_info_list')
	if (marker < 0) return null
	const region = extractBalancedArray(html, marker)
	if (!region || !region.includes('cdn_url')) return null

	const images: string[] = []
	const livePhotos: string[] = []
	for (const entry of splitTopLevelObjects(region)) {
		// 每项的第一个 cdn_url 是顶层原图；嵌套的 watermark_info.cdn_url 是带水印版，必须跳过
		const image = entry.match(/cdn_url:\s*'([^']+)'/)
		if (image) images.push(upgradeToHttps(decodeWxUrl(image[1])))

		// 实况图有多档格式（format_info），取 file_size 最大的原始档
		const formatBlock = entry.match(/format_info:\s*\[(.*?)\]/s)
		if (!formatBlock) continue
		const formats = [...formatBlock[1].matchAll(/url:\s*'([^']+)'[\s\S]*?file_size:\s*'(\d+)'/g)]
		if (formats.length === 0) continue
		const best = formats.reduce((a, b) => (BigInt(a[2]) >= BigInt(b[2]) ? a : b))
		livePhotos.push(upgradeToHttps(decodeWxUrl(best[1])))
	}
	return { images, livePhotos }
}

/** 普通图文：#js_content 里 <img data-src="mmbiz.qpic.cn/..."> */
const parseArticleImages = (html: string): string[] => {
	const contentStart = html.indexOf('id="js_content"')
	const region = contentStart >= 0 ? html.slice(contentStart) : html
	const urls: string[] = []
	for (const m of region.matchAll(/<img\b[^>]*?(?:data-src|src)="([^"]+)"/g)) {
		const url = upgradeToHttps(decodeWxUrl(m[1]))
		// 只收 mmbiz 图床，排除表情/图标等站内资源
		if (url.includes('mmbiz.qpic.cn/') && !urls.includes(url)) urls.push(url)
	}
	return urls
}

/** 普通图文里的视频：videoplayer iframe → 二次请求 get_mp_video_play_url 拿真实 mp4 */
const parseArticleVideos = async (html: string, articleUrl: string): Promise<string[]> => {
	const playerUrls = [
		...new Set(
			[...html.matchAll(/mp\/videoplayer\?[^"'\s<]+/g)].map(
				(m) => `https://mp.weixin.qq.com/${decodeHtmlEntities(m[0])}`,
			),
		),
	].slice(0, MAX_VIDEOS)

	const videos: string[] = []
	for (const playerUrl of playerUrls) {
		try {
			const res = await fetch(playerUrl, {
				headers: { 'User-Agent': WX_UA, Referer: articleUrl },
				signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
			})
			if (!res.ok) continue
			const data = (await res.json()) as { url_info?: { url?: string }[] }
			const raw = data.url_info?.find((info) => info.url)?.url
			if (!raw) continue
			const videoUrl = upgradeToHttps(raw.startsWith('//') ? `https:${raw}` : raw)
			if (!videos.includes(videoUrl)) videos.push(videoUrl)
		} catch {
			// 单个视频解析失败不影响整体
		}
	}
	return videos
}

/** 解析微信公众号文章，输出与 catsapi 一致的 MediaParseResult 结构 */
export const parseWechatArticle = async (url: string): Promise<MediaParseResult> => {
	const res = await fetch(url, {
		headers: { 'User-Agent': WX_UA },
		signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
		redirect: 'follow',
	})
	if (!res.ok) throw new Error(`文章抓取失败（HTTP ${res.status}）`)

	// 抓文章响应的 Set-Cookie 存入 jar（供 qpic.cn 媒体回带）
	const setCookies =
		(res.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ?? []
	if (setCookies.length > 0) {
		cookieJar = {
			header: setCookies.map((cookie) => cookie.split(';')[0]).join('; '),
			expiresAt: Date.now() + COOKIE_TTL_MS,
		}
	}

	const html = await res.text()
	if (!html.includes('js_content') && !html.includes('picture_page_info_list')) {
		throw new Error('文章抓取失败（可能触发微信风控），请稍后重试')
	}

	const picturePost = parsePicturePost(html)
	const images = picturePost ? picturePost.images : parseArticleImages(html)
	const livePhotos = picturePost ? picturePost.livePhotos : []
	const videos = picturePost ? [] : await parseArticleVideos(html, url)
	const cover = pickMetaContent(html, 'og:image')
	const author = pickAuthor(html)

	return {
		platform: 'wechat',
		title: pickMetaContent(html, 'og:title') || '',
		author: author ? { name: author } : null,
		cover: cover ? upgradeToHttps(cover) : images[0] || null,
		video_url: videos[0] || null,
		audio_url: null,
		videos,
		images,
		live_photos: livePhotos,
	}
}
