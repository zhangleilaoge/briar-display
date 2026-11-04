/**
 * Kimi Code 用量（参考 xifandev/KimiCodeBar）：
 * 上游 GET https://api.kimi.com/coding/v1/usages，Authorization: Bearer <sk-kimi-… API Key 或 OAuth token>。
 * 后端代理 + 短缓存，前端只拿归一化后的结果，Key 不出服务器。
 */

/** 单个窗口用量，统一成百分比；有绝对数值时一并给出 */
export interface KimiUsageWindow {
	/** 已用百分比 0~100 */
	usedPct: number
	used: number | null
	limit: number | null
	remaining: number | null
	/** ISO 时间；未知为 null */
	resetAt: string | null
}

export interface KimiUsageSummary {
	/** 5 小时滚动窗口 */
	fiveHour: KimiUsageWindow | null
	/** 7 天（老套餐）*/
	weekly: KimiUsageWindow | null
	/** 月度总额度（新会员体系）*/
	monthly: KimiUsageWindow | null
	/** 会员等级显示名，如 Allegretto */
	membership: string | null
	/** 加油包余额（元），未启用为 null */
	boosterYuan: number | null
}

export interface KimiUsageResponse {
	/** 服务端未配置 BRIAR_KIMI_API_KEY */
	configured: boolean
	data: KimiUsageSummary | null
	/** 上游失败时的错误说明（若有缓存则 data 为旧值 + stale） */
	error?: string
	stale?: boolean
	fetchedAt: number
}

const num = (v: unknown): number | null => {
	if (v == null || v === '') return null
	const n = Number(v)
	return Number.isFinite(n) ? n : null
}
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)
const clampPct = (n: number) => Math.max(0, Math.min(100, Math.round(n)))

const MEMBERSHIP: Record<string, string> = {
	LEVEL_FREE: 'Free',
	LEVEL_TRIAL: 'Trial',
	TRIAL: 'Trial',
	LEVEL_BASIC: 'Adagio',
	LEVEL_STANDARD: 'Moderato',
	LEVEL_INTERMEDIATE: 'Allegretto',
	LEVEL_ADVANCED: 'Allegro',
	LEVEL_PREMIUM: 'Vivace',
}

export function kimiMembershipName(level: string | null | undefined): string | null {
	if (!level) return null
	const hit = MEMBERSHIP[level.toUpperCase()]
	if (hit) return hit
	const pretty = level
		.replace(/^LEVEL_/i, '')
		.split('_')
		.filter(Boolean)
		.map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
		.join(' ')
	return pretty || null
}

type Obj = Record<string, unknown>
const obj = (v: unknown): Obj | null => (v && typeof v === 'object' ? (v as Obj) : null)

function absWindow(d: Obj | null): KimiUsageWindow | null {
	if (!d) return null
	const limit = num(d.limit)
	let used = num(d.used)
	const remaining = num(d.remaining)
	if (limit == null && used == null && remaining == null) return null
	if (used == null && limit != null && remaining != null) used = Math.max(0, limit - remaining)
	const pct = limit && limit > 0 && used != null ? (used / limit) * 100 : 0
	return {
		usedPct: clampPct(pct),
		used,
		limit,
		remaining: remaining ?? (limit != null && used != null ? Math.max(0, limit - used) : null),
		resetAt: str(d.resetTime) ?? str(d.reset_time),
	}
}

function ratioWindow(d: Obj | null): KimiUsageWindow | null {
	const r = num(d?.used_ratio)
	if (!d || r == null) return null
	return {
		usedPct: clampPct(r * 100),
		used: null,
		limit: null,
		remaining: null,
		resetAt: str(d.reset_time),
	}
}

/** 把上游 /coding/v1/usages 响应归一化（兼容老套餐绝对值与新会员体系 used_ratio） */
export function normalizeKimiUsage(raw: unknown): KimiUsageSummary {
	const r = obj(raw) ?? {}
	const usages = obj(r.usages)
	const limits = Array.isArray(r.limits) ? (r.limits as unknown[]).map(obj) : []
	const five = limits.find((l) => num(obj(l?.window)?.duration) === 300)

	const fiveHour = absWindow(obj(five?.detail)) ?? ratioWindow(obj(usages?.limit_5h))
	const weekly = absWindow(obj(r.usage)) ?? ratioWindow(obj(usages?.limit_7d))
	const monthly = ratioWindow(obj(usages?.limit_month_total))

	const wallet = obj(r.boosterWallet)
	const status = String(wallet?.status ?? '').toUpperCase()
	const enabled = status === 'STATUS_ACTIVE' || status === 'STATUS_ENABLED'
	const left = num(obj(wallet?.balance)?.amountLeft)
	const boosterYuan = wallet && enabled && left != null ? Math.max(0, left / 1e8) : null

	return {
		fiveHour,
		weekly,
		monthly,
		membership: kimiMembershipName(str(obj(obj(r.user)?.membership)?.level)),
		boosterYuan,
	}
}

/** 距重置的简短文案：「2时15分」「3天4时」「即将」；未知返回 null */
export function formatKimiResetIn(resetAt: string | null, now = Date.now()): string | null {
	if (!resetAt) return null
	const t = Date.parse(resetAt)
	if (!Number.isFinite(t)) return null
	const ms = t - now
	if (ms <= 60_000) return '即将'
	const min = Math.floor(ms / 60_000)
	const d = Math.floor(min / 1440)
	const h = Math.floor((min % 1440) / 60)
	const m = min % 60
	if (d > 0) return `${d}天${h}时`
	if (h > 0) return `${h}时${m}分`
	return `${m}分`
}
