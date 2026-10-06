import type { Dispatcher } from 'undici'

/**
 * 行情上游请求：先直连，失败且配置了 BRIAR_MARKET_PROXY 时再走代理重试一次。
 * 代理用于国内服务器访问海外源（Naver）或国内源临时封 IP 时兜底；不配则只直连。
 */
const UPSTREAM_UA =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
const DEFAULT_TIMEOUT_MS = 8_000

const proxyUri = () => process.env.BRIAR_MARKET_PROXY?.trim() || ''

let proxyAgent: { uri: string; agent: Promise<Dispatcher> } | null = null

const getProxyAgent = (uri: string): Promise<Dispatcher> => {
	if (!proxyAgent || proxyAgent.uri !== uri) {
		proxyAgent = {
			uri,
			agent: import('undici').then((m) => new m.ProxyAgent(uri) as Dispatcher),
		}
	}
	return proxyAgent.agent
}

export interface FetchTextOptions {
	headers?: Record<string, string>
	/** 新浪/腾讯行情是 GBK */
	encoding?: 'utf-8' | 'gbk'
	timeoutMs?: number
	/** 直连失败后的额外重试次数（Naver 偶发 404/超时），默认 0 */
	retries?: number
}

/** undici 的真实原因藏在 cause 里（fetch failed 本身没有信息量） */
const describeError = (err: unknown): string => {
	if (!(err instanceof Error)) return String(err)
	const cause = err.cause as { code?: string; message?: string } | undefined
	return cause?.code || cause?.message
		? `${err.message} (${cause.code || cause.message})`
		: err.message
}

async function fetchOnce(url: string, opts: FetchTextOptions, proxy: string | null) {
	const init = {
		headers: { 'User-Agent': UPSTREAM_UA, Accept: '*/*', ...opts.headers },
		signal: AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS),
	}
	let res: Response
	if (proxy) {
		const { fetch: undiciFetch } = await import('undici')
		res = (await undiciFetch(url, {
			...init,
			dispatcher: await getProxyAgent(proxy),
		})) as unknown as Response
	} else {
		res = await fetch(url, init)
	}
	if (!res.ok) throw new Error(`HTTP ${res.status}`)
	const text = new TextDecoder(opts.encoding ?? 'utf-8').decode(await res.arrayBuffer())
	// 东财 clist 限频时直接空回包（Empty reply），统一按失败处理
	if (!text.trim()) throw new Error('empty body')
	return text
}

/** 直连失败（含重试）后，配置了代理就走代理再试一次 */
async function fetchViaProxy(url: string, opts: FetchTextOptions, directErr: unknown) {
	const host = new URL(url).host
	const proxy = proxyUri()
	if (!proxy) throw new Error(`${host}: ${describeError(directErr)}`)
	try {
		return await fetchOnce(url, opts, proxy)
	} catch (proxyErr) {
		throw new Error(`${host}: ${describeError(directErr)}; via proxy: ${describeError(proxyErr)}`)
	}
}

export async function fetchText(url: string, opts: FetchTextOptions = {}): Promise<string> {
	const retries = opts.retries ?? 0
	for (let attempt = 0; ; attempt++) {
		try {
			return await fetchOnce(url, opts, null)
		} catch (err) {
			if (attempt >= retries) return fetchViaProxy(url, opts, err)
			await new Promise((r) => setTimeout(r, 300 * (attempt + 1)))
		}
	}
}

export async function fetchJson<T>(url: string, opts: FetchTextOptions = {}): Promise<T> {
	const text = await fetchText(url, opts)
	try {
		return JSON.parse(text) as T
	} catch {
		throw new Error(`${new URL(url).host}: invalid JSON`)
	}
}
