import type { MarketId, MarketSessionStatus, SectorItem, SectorSortKey } from '@briar/shared'

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

/** 资金净流入：带正负号（+3.20亿 / -1.10亿），币种跟成交额一致 */
export function formatFlow(value: number | null | undefined, currency = ''): string {
	if (value == null) return '—'
	return `${value > 0 ? '+' : ''}${formatAmount(value, currency)}`
}

/** 净流入口径的短名（表头小字）：「主力净流入（…）」→「主力净流入」 */
export function flowBasisShort(basis: string | null | undefined): string {
	return basis ? basis.replace(/（.*$/, '') : '暂无数据'
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

/**
 * 列表 / 热力图排序维度：后端给的热度字段（sortKeys）+ 前端可算的名称 / 涨跌家数 / 领涨股涨幅。
 * 表头点击和上方下拉共用这一份状态。
 */
export type ListSortKey = SectorSortKey | 'name' | 'breadth' | 'leaderPct'
export type SortDirection = 'desc' | 'asc'

export const SORT_LABELS: Record<ListSortKey, string> = {
	changePct: '涨跌幅',
	amount: '成交额',
	netInflow: '资金净流入',
	turnoverRate: '换手率',
	breadth: '上涨占比',
	leaderPct: '领涨股涨幅',
	name: '板块名称',
}

/** 下拉 / 表头的展示顺序 */
const SORT_ORDER: ListSortKey[] = [
	'changePct',
	'netInflow',
	'amount',
	'turnoverRate',
	'breadth',
	'leaderPct',
	'name',
]

/** 涨跌家数按「上涨家数 / 成分股总数」排（腾讯只给上涨和总数，Naver 还有下跌，统一用占比可比） */
export const BREADTH_SORT_HINT = '按上涨占比（上涨家数 / 成分股总数）排序'

/** 某维度的排序值；null = 缺失（永远排最后） */
export function sortValue(item: SectorItem, key: Exclude<ListSortKey, 'name'>): number | null {
	switch (key) {
		case 'breadth':
			return item.total && item.upCount != null ? item.upCount / item.total : null
		case 'leaderPct':
			return item.leader?.changePct ?? null
		default:
			return item[key]
	}
}

/** 当前数据可用的排序维度：后端 sortKeys + 有数据的前端维度 + 名称 */
export function availableSortKeys(items: SectorItem[], serverKeys: SectorSortKey[]): ListSortKey[] {
	const extra: ListSortKey[] = ['name']
	if (items.some((i) => sortValue(i, 'breadth') != null)) extra.push('breadth')
	if (items.some((i) => sortValue(i, 'leaderPct') != null)) extra.push('leaderPct')
	const keys = new Set<ListSortKey>([...serverKeys, ...extra])
	return SORT_ORDER.filter((k) => keys.has(k))
}

const nameCollator = new Intl.Collator('zh-CN')

/** 排序：数值维度按值，名称按中文 localeCompare('zh-CN')；缺失值无论升降序都排最后；稳定排序 */
export function sortSectors(
	items: SectorItem[],
	key: ListSortKey,
	direction: SortDirection = 'desc',
): SectorItem[] {
	const sign = direction === 'desc' ? -1 : 1
	if (key === 'name') {
		return [...items].sort((a, b) => sign * nameCollator.compare(a.name, b.name))
	}
	return [...items].sort((a, b) => {
		const va = sortValue(a, key)
		const vb = sortValue(b, key)
		if (va == null && vb == null) return 0
		if (va == null) return 1
		if (vb == null) return -1
		return sign * (va - vb)
	})
}

/** 表头点击：点新列从降序开始，再点同一列切换升降序 */
export function nextSort(
	current: { key: ListSortKey; direction: SortDirection },
	clicked: ListSortKey,
): { key: ListSortKey; direction: SortDirection } {
	if (current.key !== clicked) return { key: clicked, direction: 'desc' }
	return { key: clicked, direction: current.direction === 'desc' ? 'asc' : 'desc' }
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

/** 分时横轴/提示用的当地时区简称 */
export const TZ_LABELS: Record<MarketId, string> = {
	cn: '北京',
	hk: '香港',
	us: '美东',
	jp: '东京',
	kr: '首尔',
}

const zonedFormatters = new Map<string, Intl.DateTimeFormat>()

/** 指定时区的 HH:mm */
export function formatZonedHm(ts: number, timeZone: string): string {
	let fmt = zonedFormatters.get(timeZone)
	if (!fmt) {
		fmt = new Intl.DateTimeFormat('zh-CN', {
			timeZone,
			hourCycle: 'h23',
			hour: '2-digit',
			minute: '2-digit',
		})
		zonedFormatters.set(timeZone, fmt)
	}
	return fmt.format(new Date(ts))
}
