'use client'

import { getSectorConstituents } from '@/api/markets'
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
import type { ConstituentItem, MarketId, SectorKind } from '@briar/shared'
import { Loader2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { StaleBadge } from './MarketStatusBar'
import SortHead from './SortHead'
import {
	CONSTITUENT_LABELS,
	type ConstituentListKey,
	displayCode,
	sortConstituents,
} from './constituents'
import {
	type SortDirection,
	changeColorClass,
	flowBasisShort,
	formatAmount,
	formatFlow,
	formatPct,
	formatPrice,
	nextSort,
} from './marketUtils'
import { unwrap, useMarketPolling } from './useMarketPolling'

const PAGE = 50

interface SectorConstituentsProps {
	market: MarketId
	code: string
	kind: SectorKind
	onSelect: (item: ConstituentItem) => void
}

/** 板块成分股表：表头排序规则与板块列表一致（先降序再升序、箭头、空值最后），分页展示 */
export default function SectorConstituents({
	market,
	code,
	kind,
	onSelect,
}: SectorConstituentsProps) {
	const [sortKey, setSortKey] = useState<ConstituentListKey>('changePct')
	const [direction, setDirection] = useState<SortDirection>('desc')
	const [limit, setLimit] = useState(PAGE)

	const { data, error, loading } = useMarketPolling(
		async () => unwrap(await getSectorConstituents(market, code, kind)),
		(d) => (d.available ? d.session.pollMs : 30 * 60_000),
		[market, code, kind],
	)
	const current = data && data.code === code ? data : null
	const sortable = useMemo<ConstituentListKey[]>(
		() => (current ? ['name', ...current.sortKeys] : []),
		[current],
	)
	const effective = sortable.includes(sortKey) ? sortKey : 'changePct'
	const sorted = useMemo(
		() => (current ? sortConstituents(current.items, effective, direction) : []),
		[current, effective, direction],
	)
	const onSort = (key: ConstituentListKey) => {
		const next = nextSort({ key: effective, direction }, key)
		setSortKey(next.key)
		setDirection(next.direction)
		setLimit(PAGE)
	}

	if (!current) {
		return (
			<div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
				{loading || data ? (
					<>
						<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						加载成分股中…
					</>
				) : (
					error || '成分股暂时不可用'
				)}
			</div>
		)
	}
	if (!current.available) {
		return (
			<div className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
				<div>该板块暂无成分股数据</div>
				{current.reason && (
					<div className="mt-1 text-xs text-muted-foreground/80">{current.reason}</div>
				)}
			</div>
		)
	}
	if (sorted.length === 0) {
		return <p className="py-6 text-center text-sm text-muted-foreground">暂无成分股</p>
	}

	const has = (k: ConstituentListKey) => sortable.includes(k)
	/** 非当前排序列在小屏隐藏 */
	const col = (key: ConstituentListKey, base: string) => (effective === key ? '' : base)
	const head = (key: ConstituentListKey) => ({
		sortKey: key,
		current: effective,
		direction,
		sortable: has(key),
		onSort,
	})
	const currency = current.amountCurrency
	const shown = sorted.slice(0, limit)

	return (
		<div className="space-y-2">
			<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
				<span className="font-medium text-foreground">成分股</span>
				<span>
					共 {current.total} 只
					{current.items.length < current.total ? `，已取 ${current.items.length} 只` : ''}
				</span>
				{current.truncatedNote && <span>{current.truncatedNote}</span>}
				{current.stale && <StaleBadge error={current.error} />}
				<span className="ml-auto">数据源 {current.source}</span>
			</div>
			<div className="rounded-lg border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead className="w-8 px-2 text-center">#</TableHead>
							<SortHead {...head('name')} label="名称" align="left" title="按名称（中文排序）" />
							{has('price') && (
								<SortHead
									{...head('price')}
									label="现价"
									className={col('price', 'hidden sm:table-cell')}
								/>
							)}
							<SortHead {...head('changePct')} label="涨跌幅" />
							{current.netInflowBasis && (
								<SortHead
									{...head('netInflow')}
									className={col('netInflow', 'hidden sm:table-cell')}
									title={`口径：${current.netInflowBasis}。正数为流入，负数为流出`}
									label={
										<>
											<div className="leading-tight">净流入</div>
											<div className="text-[10px] font-normal leading-tight text-muted-foreground/80">
												{flowBasisShort(current.netInflowBasis)}
											</div>
										</>
									}
								/>
							)}
							{has('amount') && (
								<SortHead
									{...head('amount')}
									label="成交额"
									className={col('amount', 'hidden sm:table-cell')}
								/>
							)}
							{has('turnoverRate') && (
								<SortHead
									{...head('turnoverRate')}
									label="换手率"
									className={col('turnoverRate', 'hidden md:table-cell')}
								/>
							)}
							{has('marketCap') && (
								<SortHead
									{...head('marketCap')}
									label="总市值"
									className={col('marketCap', 'hidden md:table-cell')}
								/>
							)}
							{has('pe') && (
								<SortHead
									{...head('pe')}
									label="市盈率"
									title={current.peBasis ?? undefined}
									className={col('pe', 'hidden lg:table-cell')}
								/>
							)}
						</TableRow>
					</TableHeader>
					<TableBody>
						{shown.map((item, index) => (
							<TableRow
								key={item.code}
								tabIndex={0}
								className="cursor-pointer"
								onClick={() => onSelect(item)}
								onKeyDown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault()
										onSelect(item)
									}
								}}
							>
								<TableCell className="px-2 text-center text-xs text-muted-foreground tabular-nums">
									{index + 1}
								</TableCell>
								<TableCell className="max-w-[10rem] py-2">
									<div className="truncate font-medium" title={item.name}>
										{item.name}
									</div>
									<div className="text-xs text-muted-foreground tabular-nums">
										{displayCode(item.code)}
										{effective !== 'price' && (
											<span className="sm:hidden"> · {formatPrice(item.price)}</span>
										)}
									</div>
								</TableCell>
								{has('price') && (
									<TableCell
										className={cn('text-right tabular-nums', col('price', 'hidden sm:table-cell'))}
									>
										{formatPrice(item.price)}
									</TableCell>
								)}
								<TableCell
									className={cn(
										'text-right font-medium tabular-nums',
										changeColorClass(item.changePct),
									)}
								>
									{formatPct(item.changePct)}
								</TableCell>
								{current.netInflowBasis && (
									<TableCell
										className={cn(
											'whitespace-nowrap text-right tabular-nums',
											changeColorClass(item.netInflow),
											col('netInflow', 'hidden sm:table-cell'),
										)}
									>
										{formatFlow(item.netInflow, currency)}
									</TableCell>
								)}
								{has('amount') && (
									<TableCell
										className={cn(
											'whitespace-nowrap text-right tabular-nums',
											col('amount', 'hidden sm:table-cell'),
										)}
									>
										{formatAmount(item.amount, currency)}
									</TableCell>
								)}
								{has('turnoverRate') && (
									<TableCell
										className={cn(
											'text-right tabular-nums',
											col('turnoverRate', 'hidden md:table-cell'),
										)}
									>
										{item.turnoverRate == null ? '--' : `${item.turnoverRate.toFixed(2)}%`}
									</TableCell>
								)}
								{has('marketCap') && (
									<TableCell
										className={cn(
											'whitespace-nowrap text-right tabular-nums',
											col('marketCap', 'hidden md:table-cell'),
										)}
									>
										{formatAmount(item.marketCap, currency)}
									</TableCell>
								)}
								{has('pe') && (
									<TableCell
										className={cn('text-right tabular-nums', col('pe', 'hidden lg:table-cell'))}
									>
										{item.pe == null ? '--' : item.pe.toFixed(2)}
									</TableCell>
								)}
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
			{sorted.length > PAGE && (
				<div className="flex justify-center gap-2">
					{limit < sorted.length && (
						<Button variant="outline" size="sm" onClick={() => setLimit((l) => l + PAGE)}>
							再显示 {Math.min(PAGE, sorted.length - limit)} 只
						</Button>
					)}
					{limit < sorted.length && (
						<Button variant="ghost" size="sm" onClick={() => setLimit(sorted.length)}>
							显示全部 {sorted.length} 只
						</Button>
					)}
					{limit >= sorted.length && (
						<Button variant="ghost" size="sm" onClick={() => setLimit(PAGE)}>
							收起，只看前 {PAGE} 只
						</Button>
					)}
				</div>
			)}
			<p className="text-[11px] text-muted-foreground/80">
				按{CONSTITUENT_LABELS[effective]}
				{effective === 'name' ? '' : direction === 'desc' ? '从高到低' : '从低到高'} ·
				点击个股看详情与走势
			</p>
		</div>
	)
}
