/**
 * twimg 中转 Worker：国内服务器无法直连 video.twimg.com / pbs.twimg.com（GFW），
 * 由 Cloudflare 边缘节点代拉字节流并原样回传（含 Range，支持视频分段/拖进度）。
 * 仅放行 *.twimg.com + 可选 PROXY_KEY（wrangler secret），避免被当开放代理。
 * 部署：bunx wrangler deploy（目录下 wrangler.toml 已配好）
 */

const ALLOWED_HOST_SUFFIX = '.twimg.com'
const UA =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

/** 回传给客户端的响应头白名单 */
const PASS_HEADERS = ['Content-Type', 'Content-Length', 'Content-Range', 'Accept-Ranges']

export default {
	async fetch(request, env) {
		if (request.method !== 'GET' && request.method !== 'HEAD') {
			return new Response('method not allowed', { status: 405 })
		}
		const reqUrl = new URL(request.url)
		if (env.PROXY_KEY && reqUrl.searchParams.get('key') !== env.PROXY_KEY) {
			return new Response('forbidden', { status: 403 })
		}
		const raw = reqUrl.searchParams.get('url')
		if (!raw) return new Response('missing url', { status: 400 })

		let target
		try {
			target = new URL(raw)
		} catch {
			return new Response('bad url', { status: 400 })
		}
		const host = target.hostname.toLowerCase()
		if (
			target.protocol !== 'https:' ||
			!(host === 'twimg.com' || host.endsWith(ALLOWED_HOST_SUFFIX))
		) {
			return new Response('host not allowed', { status: 403 })
		}

		const headers = new Headers({ 'User-Agent': UA })
		const range = request.headers.get('Range')
		if (range) headers.set('Range', range)

		const upstream = await fetch(target.toString(), { headers, redirect: 'follow' })
		const respHeaders = new Headers()
		for (const key of PASS_HEADERS) {
			const value = upstream.headers.get(key)
			if (value) respHeaders.set(key, value)
		}
		return new Response(upstream.body, { status: upstream.status, headers: respHeaders })
	},
}
