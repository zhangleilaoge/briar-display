import type { SectorItem, SectorSortKey } from '@briar/shared'
import { useMemo } from 'react'
import { formatAmount, formatPct, heatScale, heatStyle } from './marketUtils'

interface SectorHeatmapProps {
	items: SectorItem[]
	sortKey: SectorSortKey
	amountCurrency: string
	/** 板块太多时只画前 N 个（按当前排序） */
	limit?: number
	/** 点击色块（查看当日分时） */
	onSelect?: (item: SectorItem) => void
}

/** 涨跌家数：腾讯只有「上涨/总数」，Naver 有上涨/下跌 */
function breadth(item: SectorItem): string {
	const up = `上涨 ${item.upCount ?? 0}`
	return item.downCount != null ? `${up} / 下跌 ${item.downCount}` : `${up} / 共 ${item.total}`
}

/** 副标题：按成交额/净流入排序时显示对应数值，否则显示领涨股 */
function subtitle(item: SectorItem, sortKey: SectorSortKey, currency: string): string {
	if (sortKey === 'amount' && item.amount != null) return formatAmount(item.amount, currency)
	if (sortKey === 'netInflow' && item.netInflow != null)
		return `净流入 ${formatAmount(item.netInflow)}`
	if (sortKey === 'turnoverRate' && item.turnoverRate != null)
		return `换手 ${item.turnoverRate.toFixed(2)}%`
	if (item.leader) return item.leader.name
	if (item.amount != null) return formatAmount(item.amount, currency)
	if (item.total) return breadth(item)
	return ''
}

function tooltip(item: SectorItem, currency: string): string {
	const lines = [
		`${item.name}${item.rawName ? `（${item.rawName}）` : ''}  ${formatPct(item.changePct)}`,
	]
	if (item.amount != null) lines.push(`成交额 ${formatAmount(item.amount, currency)}`)
	if (item.netInflow != null) lines.push(`主力净流入 ${formatAmount(item.netInflow)}`)
	if (item.turnoverRate != null) lines.push(`换手率 ${item.turnoverRate.toFixed(2)}%`)
	if (item.total) lines.push(breadth(item))
	if (item.leader) lines.push(`领涨 ${item.leader.name} ${formatPct(item.leader.changePct)}`)
	return lines.join('\n')
}

/** 板块热力图：红涨绿跌，颜色深浅按涨跌幅强度（随当前列表波动自适应） */
export default function SectorHeatmap({
	items,
	sortKey,
	amountCurrency,
	limit = 60,
	onSelect,
}: SectorHeatmapProps) {
	const scale = useMemo(() => heatScale(items), [items])
	const shown = items.slice(0, limit)

	if (shown.length === 0) {
		return <p className="py-10 text-center text-sm text-muted-foreground">暂无板块数据</p>
	}

	return (
		<div>
			<div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
				{shown.map((item) => {
					const sub = subtitle(item, sortKey, amountCurrency)
					return (
						<button
							type="button"
							key={item.code}
							title={tooltip(item, amountCurrency)}
							style={heatStyle(item.changePct, scale)}
							onClick={() => onSelect?.(item)}
							className="flex min-h-[68px] min-w-0 flex-col justify-center rounded-lg px-2 py-1.5 text-center shadow-sm transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
						>
							<div className="truncate text-xs font-medium sm:text-sm">{item.name}</div>
							<div className="text-sm font-semibold tabular-nums">{formatPct(item.changePct)}</div>
							{sub && <div className="truncate text-[10px] opacity-80 sm:text-[11px]">{sub}</div>}
						</button>
					)
				})}
			</div>
			{items.length > shown.length && (
				<p className="mt-2 text-xs text-muted-foreground">
					热力图按当前排序显示前 {shown.length} 个，共 {items.length} 个板块，完整数据见下方列表
				</p>
			)}
		</div>
	)
}
