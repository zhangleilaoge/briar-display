/** 完整 magnet 链接（40 位 hex hash，可带 & 后续参数） */
const MAGNET_RE = /magnet:\?xt=urn:btih:([a-fA-F0-9]{40})(&\S*)?/i
/** 裸 40 位 hex hash */
const BARE_HASH_RE = /(?:^|[^a-fA-F0-9])([a-fA-F0-9]{40})(?:[^a-fA-F0-9]|$)/i
/** ed2k 链接 */
const ED2K_RE = /^ed2k:\/\/\|file\|.+\|\/$/i
/** 其他形态的 magnet（如 32 位 base32 hash），原样交给后端/上游判定 */
const ANY_MAGNET_RE = /^magnet:\?\S*xt=urn:btih:[a-zA-Z2-7=]+/i

/** 与后端 normalizeMagnetInput 同规则，前端先做一层即时校验 */
export function normalizeMagnetInput(raw: string): string | null {
	const input = raw.trim().replace(/\s+/g, '')
	if (!input) return null
	const magnet = input.match(MAGNET_RE)
	if (magnet) return `magnet:?xt=urn:btih:${magnet[1].toLowerCase()}${magnet[2] ?? ''}`
	const bare = input.match(BARE_HASH_RE)
	if (bare) return `magnet:?xt=urn:btih:${bare[1].toLowerCase()}`
	if (ED2K_RE.test(input)) return input
	if (ANY_MAGNET_RE.test(input)) return input
	return null
}

/** 字节数 → 可读大小（B/KB/MB/GB/TB） */
export function formatBytes(bytes: number): string {
	if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
	const units = ['B', 'KB', 'MB', 'GB', 'TB']
	const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
	return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 2)} ${units[i]}`
}

/** 读取地址栏 ?url= 参数（分享链接直达，参考 clyl.246811.xyz 的行为） */
export function readUrlParam(): string {
	try {
		return new URLSearchParams(window.location.search).get('url') ?? ''
	} catch {
		return ''
	}
}

/** 把查询链接写回地址栏（replaceState，不污染历史记录） */
export function writeUrlParam(link: string) {
	try {
		const params = new URLSearchParams(window.location.search)
		if (link) params.set('url', link)
		else params.delete('url')
		const query = params.toString()
		window.history.replaceState(
			null,
			'',
			query ? `${window.location.pathname}?${query}` : window.location.pathname,
		)
	} catch {
		// 忽略（极端环境下 history API 不可用）
	}
}
