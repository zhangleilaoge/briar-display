import type { ConstituentItem, ConstituentSortKey } from '@briar/shared'
import { type SortDirection, nameCollator } from './marketUtils'

/** 成分股表：排序维度 = 后端 sortKeys + 名称 */
export type ConstituentListKey = ConstituentSortKey | 'name'

export const CONSTITUENT_LABELS: Record<ConstituentListKey, string> = {
	name: '名称',
	price: '现价',
	changePct: '涨跌幅',
	amount: '成交额',
	turnoverRate: '换手率',
	netInflow: '净流入',
	marketCap: '总市值',
	pe: '市盈率',
}

/** 与板块列表同一规则：数值按值，名称按 zh-CN；缺失值无论升降序都排最后；稳定排序 */
export function sortConstituents(
	items: ConstituentItem[],
	key: ConstituentListKey,
	direction: SortDirection = 'desc',
): ConstituentItem[] {
	const sign = direction === 'desc' ? -1 : 1
	if (key === 'name') return [...items].sort((a, b) => sign * nameCollator.compare(a.name, b.name))
	return [...items].sort((a, b) => {
		const va = a[key]
		const vb = b[key]
		if (va == null && vb == null) return 0
		if (va == null) return 1
		if (vb == null) return -1
		return sign * (va - vb)
	})
}

/** 个股代码展示：sh600519 → 600519（A股前缀只用于接口） */
export const displayCode = (code: string) => code.replace(/^(sh|sz|bj)(?=\d{6}$)/, '')
