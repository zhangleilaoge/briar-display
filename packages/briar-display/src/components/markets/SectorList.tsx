import { Button } from '@/components/ui/button'
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { SectorItem } from '@briar/shared'
import { useState } from 'react'
import SortHead from './SortHead'
import {
	BREADTH_SORT_HINT,
	type ListSortKey,
	type SortDirection,
	changeColorClass,
	flowBasisShort,
	formatAmount,
	formatFlow,
	formatPct,
} from './marketUtils'

interface SectorListProps {
	items: SectorItem[]
	sortKey: ListSortKey
	direction?: SortDirection
	/** 当前可排序的维度（没有数据的列不可点） */
	sortableKeys?: ListSortKey[]
	/** 点击表头排序（与上方下拉共用状态） */
	onSort?: (key: ListSortKey) => void
	amountCurrency: string
	/** 净流入口径；null = 该市场没有资金流数据（列显示「—」） */
	netInflowBasis?: string | null
	pageSize?: number
	/** 点击行（打开走势面板） */
	onSelect?: (item: SectorItem) => void
}

/** 板块列表：只显示数据源确实提供的列；表头可点击排序；当前排序列在手机端也保留 */
export default function SectorList({
	items,
	sortKey,
	direction = 'desc',
	sortableKeys = [],
	onSort,
	amountCurrency,
	netInflowBasis = null,
	pageSize = 100,
	onSelect,
}: SectorListProps) {
	const [showAll, setShowAll] = useState(false)
	const shown = showAll ? items : items.slice(0, pageSize)

	const has = {
		amount: items.some((i) => i.amount != null),
		turnoverRate: items.some((i) => i.turnoverRate != null),
		breadth: items.some((i) => i.total != null && i.total > 0),
		leader: items.some((i) => i.leader != null),
	}
	/** 非当前排序列在小屏隐藏 */
	const col = (key: ListSortKey, base: string) => (sortKey === key ? '' : base)
	const head = (key: ListSortKey) => ({
		sortKey: key,
		current: sortKey,
		direction,
		sortable: sortableKeys.includes(key),
		onSort,
	})

	if (items.length === 0) {
		return <p className="py-10 text-center text-sm text-muted-foreground">暂无板块数据</p>
	}

	return (
		<div>
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead className="w-10 text-center">#</TableHead>
						<SortHead {...head('name')} label="板块" align="left" title="按板块名称（中文排序）" />
						<SortHead {...head('changePct')} label="涨跌幅" />
						<SortHead
							{...head('netInflow')}
							className={col('netInflow', 'hidden sm:table-cell')}
							title={
								netInflowBasis
									? `口径：${netInflowBasis}。正数为流入，负数为流出`
									: '该市场数据源不提供资金流'
							}
							label={
								<>
									<div className="leading-tight">净流入</div>
									<div className="text-[10px] font-normal leading-tight text-muted-foreground/80">
										{flowBasisShort(netInflowBasis)}
									</div>
								</>
							}
						/>
						{has.amount && (
							<SortHead
								{...head('amount')}
								label="成交额"
								className={col('amount', 'hidden sm:table-cell')}
							/>
						)}
						{has.turnoverRate && (
							<SortHead
								{...head('turnoverRate')}
								label="换手率"
								className={col('turnoverRate', 'hidden md:table-cell')}
							/>
						)}
						{has.breadth && (
							<SortHead
								{...head('breadth')}
								label="涨跌家数"
								className={col('breadth', 'hidden lg:table-cell')}
								title={BREADTH_SORT_HINT}
							/>
						)}
						{has.leader && (
							<SortHead
								{...head('leaderPct')}
								label="领涨股"
								align="left"
								className={col('leaderPct', 'hidden sm:table-cell')}
								title="按领涨股涨幅排序"
							/>
						)}
					</TableRow>
				</TableHeader>
				<TableBody>
					{shown.map((item, index) => (
						<TableRow
							key={item.code}
							tabIndex={onSelect ? 0 : undefined}
							className={onSelect ? 'cursor-pointer' : undefined}
							onClick={() => onSelect?.(item)}
							onKeyDown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault()
									onSelect?.(item)
								}
							}}
						>
							<TableCell className="text-center text-xs text-muted-foreground tabular-nums">
								{index + 1}
							</TableCell>
							<TableCell className="max-w-[12rem]">
								<div className="truncate font-medium" title={item.rawName || item.name}>
									{item.name}
								</div>
								{(item.rawName || item.leader) && (
									<div className="truncate text-xs text-muted-foreground">
										{item.rawName && item.rawName !== item.name ? item.rawName : null}
										{item.leader && (
											<span className="sm:hidden">
												{item.rawName && item.rawName !== item.name ? ' · ' : ''}
												{item.leader.name} {formatPct(item.leader.changePct)}
											</span>
										)}
									</div>
								)}
							</TableCell>
							<TableCell
								className={cn(
									'text-right font-medium tabular-nums',
									changeColorClass(item.changePct),
								)}
							>
								{formatPct(item.changePct)}
							</TableCell>
							<TableCell
								className={cn(
									'whitespace-nowrap text-right tabular-nums',
									changeColorClass(item.netInflow),
									col('netInflow', 'hidden sm:table-cell'),
								)}
							>
								{formatFlow(item.netInflow, amountCurrency)}
							</TableCell>
							{has.amount && (
								<TableCell
									className={cn('text-right tabular-nums', col('amount', 'hidden sm:table-cell'))}
								>
									{formatAmount(item.amount, amountCurrency)}
								</TableCell>
							)}
							{has.turnoverRate && (
								<TableCell
									className={cn(
										'text-right tabular-nums',
										col('turnoverRate', 'hidden md:table-cell'),
									)}
								>
									{item.turnoverRate == null ? '--' : `${item.turnoverRate.toFixed(2)}%`}
								</TableCell>
							)}
							{has.breadth && (
								<TableCell
									className={cn('text-right tabular-nums', col('breadth', 'hidden lg:table-cell'))}
								>
									{!item.total ? (
										'--'
									) : item.downCount != null ? (
										<>
											<span className="text-red-600">{item.upCount ?? 0}</span>
											<span className="text-muted-foreground"> / </span>
											<span className="text-green-600">{item.downCount}</span>
										</>
									) : (
										// 腾讯只给「上涨家数/成分股总数」
										<>
											<span className="text-red-600">{item.upCount ?? 0}</span>
											<span className="text-muted-foreground"> / 共 {item.total}</span>
										</>
									)}
								</TableCell>
							)}
							{has.leader && (
								<TableCell className={col('leaderPct', 'hidden sm:table-cell')}>
									{item.leader ? (
										<span className="whitespace-nowrap">
											{item.leader.name}{' '}
											<span className={cn('tabular-nums', changeColorClass(item.leader.changePct))}>
												{formatPct(item.leader.changePct)}
											</span>
										</span>
									) : (
										'--'
									)}
								</TableCell>
							)}
						</TableRow>
					))}
				</TableBody>
			</Table>
			{items.length > pageSize && (
				<div className="mt-3 flex justify-center">
					<Button variant="outline" size="sm" onClick={() => setShowAll((v) => !v)}>
						{showAll ? `收起，只看前 ${pageSize} 个` : `显示全部 ${items.length} 个板块`}
					</Button>
				</div>
			)}
		</div>
	)
}
