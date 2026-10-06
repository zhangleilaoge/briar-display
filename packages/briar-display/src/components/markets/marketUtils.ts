import type { MarketSessionStatus, SectorItem, SectorSortKey } from '@briar/shared'

/** 红涨绿跌（所有市场统一） */
export function changeColorClass(pct: number | null | undefined): string {
	if (pct == null || pct === 0) return 'text-muted-foreground'
	return pct > 0 ? 'text-red-600' : 'text-green-600'
}

export function formatPct(pct: number | null | undefined): string {
	if (pct == null) return '--'
	return `${pct > 0 ? '+' : ''}${pct.toFixed(2)}%`
}

export function formatPrice(value: number | null | undefined): string {
	if (value == null) return '--'
	return value.toLocaleString('zh-CN', { maximumFractionDigits: value >= 1000 ? 2 : 3 })
}

/** 金额：万 / 亿 / 万亿，保留符号（主力净流入可为负） */
export function formatAmount(value: number | null | undefined, currency = ''): string {
	if (value == null) return '--'
	const abs = Math.abs(value)
	const sign = value < 0 ? '-' : ''
	const unit = currency && currency !== 'CNY' ? ` ${currency}` : ''
	if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(2)}万亿${unit}`
	if (abs >= 1e8) return `${sign}${(abs / 1e8).toFixed(2)}亿${unit}`
	if (abs >= 1e4) return `${sign}${(abs / 1e4).toFixed(abs >= 1e6 ? 0 : 1)}万${unit}`
	return `${sign}${abs.toFixed(0)}${unit}`
}

const shanghaiDateKey = (t: number) =>
	new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date(t))

/** 时间统一按 Asia/Shanghai 展示；不是今天的带上日期 */
export function formatShanghaiTime(ts: number | null | undefined): string {
	if (!ts) return '--'
	const fmt = (opts: Intl.DateTimeFormatOptions) =>
		new Intl.DateTimeFormat('zh-CN', {
			timeZone: 'Asia/Shanghai',
			hourCycle: 'h23',
			...opts,
		}).format(new Date(ts))
	const time = fmt({ hour: '2-digit', minute: '2-digit', second: '2-digit' })
	if (shanghaiDateKey(ts) === shanghaiDateKey(Date.now())) return time
	return `${fmt({ month: '2-digit', day: '2-digit' })} ${time}`
}

export const SESSION_LABELS: Record<MarketSessionStatus, string> = {
	open: '交易中',
	break: '午间休市',
	pre: '未开盘',
	closed: '已收盘',
}

export function sessionBadgeClass(status: MarketSessionStatus): string {
	switch (status) {
		case 'open':
			return 'border-transparent bg-red-500/10 text-red-600'
		case 'break':
			return 'border-transparent bg-amber-500/10 text-amber-700'
		default:
			return 'border-transparent bg-muted text-muted-foreground'
	}
}

export const SORT_LABELS: Record<SectorSortKey, string> = {
	changePct: '涨跌幅',
	amount: '成交额',
	netInflow: '资金净流入',
	turnoverRate: '换手率',
}

/** 按热度维度降序；涨跌幅支持升序看跌幅榜；缺失值排最后 */
export function sortSectors(
	items: SectorItem[],
	key: SectorSortKey,
	direction: 'desc' | 'asc' = 'desc',
): SectorItem[] {
	const sign = direction === 'desc' ? -1 : 1
	return [...items].sort((a, b) => {
		const va = a[key]
		const vb = b[key]
		if (va == null && vb == null) return 0
		if (va == null) return 1
		if (vb == null) return -1
		return sign * (va - vb)
	})
}

/**
 * 热力图色块底色：红涨绿跌，强度按 |涨跌幅| / 封顶值线性映射。
 * 封顶值随当前列表波动自适应（取 90 分位，最小 1%），避免日韩小波动时整屏发白、A股概念大波动时整屏饱和。
 */
export function heatScale(items: SectorItem[]): number {
	const abs = items
		.map((i) => Math.abs(i.changePct ?? 0))
		.filter((v) => v > 0)
		.sort((a, b) => a - b)
	if (abs.length === 0) return 1
	return Math.max(1, abs[Math.floor(abs.length * 0.9)] ?? abs[abs.length - 1])
}

export function heatStyle(
	pct: number | null,
	scale: number,
): { backgroundColor: string; color: string } {
	if (pct == null || pct === 0) {
		return { backgroundColor: 'hsl(210 30% 90%)', color: 'hsl(215 22% 30%)' }
	}
	const intensity = Math.min(1, Math.abs(pct) / scale)
	// 浅 → 深：up 0~360 色相红，down 绿
	const lightness = 88 - intensity * 46
	const hue = pct > 0 ? 0 : 142
	const saturation = pct > 0 ? 72 : 62
	return {
		backgroundColor: `hsl(${hue} ${saturation}% ${lightness}%)`,
		color: lightness < 60 ? '#fff' : pct > 0 ? 'hsl(0 70% 28%)' : 'hsl(142 60% 20%)',
	}
}
