import type { Dispatcher } from 'undici'

/**
 * 海外站点出站代理（Pornhub 等国内不可达平台），配置 BRIAR_MEDIA_OUTBOUND_PROXY 生效。
 * 支持 http/https 代理 URI（如 http://127.0.0.1:7890）；不配则全局 fetch 直连。
 * 页面抓取与媒体代理必须走同一代理出口：phncdn 签名 URL 绑定解析方出口 IP，换 IP 即 403。
 */
const proxyUri = () => process.env.BRIAR_MEDIA_OUTBOUND_PROXY?.trim() || ''

export const hasOutboundProxy = () => Boolean(proxyUri())

let dispatcherPromise: Promise<Dispatcher> | null = null

const getDispatcher = (): Promise<Dispatcher> | null => {
	const uri = proxyUri()
	if (!uri) return null
	dispatcherPromise ??= import('undici')
		.then((m) => new m.ProxyAgent(uri))
		.catch((err) => {
			dispatcherPromise = null
			throw err
		})
	return dispatcherPromise
}

/** 配了出站代理走 undici fetch（ProxyAgent 生效），否则全局 fetch 直连；返回类型按全局 Response 用 */
export const fetchOutbound = async (url: string, init?: RequestInit): Promise<Response> => {
	const pending = getDispatcher()
	if (!pending) return fetch(url, init)
	const dispatcher = await pending
	const { fetch: undiciFetch } = await import('undici')
	return undiciFetch(url, {
		...(init as Record<string, unknown>),
		dispatcher,
	}) as unknown as Response
}
