'use client'

import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { MARKET_LABELS } from '@briar/shared'
import { ChevronLeft } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ChartPanelBody } from './MarketChartPanel'
import SectorConstituents from './SectorConstituents'
import StockDetailView from './StockDetailView'
import { displayCode } from './constituents'
import {
	type DetailView,
	backLabel,
	openStack,
	popView,
	pushView,
	topView,
	viewKey,
	viewTitle,
} from './dialogStack'

interface MarketDetailDialogProps {
	/** 打开时的第一层（指数 / 板块 / 个股）；null = 关闭 */
	view: DetailView | null
	onClose: () => void
}

function describe(view: DetailView): string {
	if (view.kind === 'stock') return `${MARKET_LABELS[view.market]}个股 · 红涨绿跌`
	if (view.subject.target === 'index') return '大盘指数走势 · 红涨绿跌'
	return '板块走势与成分股 · 红涨绿跌'
}

/**
 * 行情详情弹窗：同一个弹窗里做导航栈（板块 → 个股 → 返回），标题随当前层变化；
 * 指数 / 板块显示走势面板，板块下面再列成分股，个股显示报价头 + 走势 + 自选按钮
 */
export default function MarketDetailDialog({ view, onClose }: MarketDetailDialogProps) {
	const [source, setSource] = useState(view)
	const [stack, setStack] = useState(() => openStack(view))
	// 外部换了打开对象（或关闭）就重置栈（渲染期调整 state，避免先闪一帧旧内容）
	if (view !== source) {
		setSource(view)
		setStack(openStack(view))
	}
	const top = topView(stack)
	const contentRef = useRef<HTMLDivElement>(null)
	const topKey = top ? viewKey(top) : ''
	// 进入 / 返回一层时回到顶部
	useEffect(() => {
		if (topKey) contentRef.current?.scrollTo({ top: 0 })
	}, [topKey])

	const back = backLabel(stack)
	const title = top ? viewTitle(top) : null

	return (
		<Dialog open={top != null} onOpenChange={(open) => !open && onClose()}>
			<DialogContent
				ref={contentRef}
				className="max-h-[92vh] w-[calc(100%-1rem)] max-w-3xl overflow-y-auto rounded-2xl p-3 sm:p-6"
			>
				{top && title && (
					<>
						<DialogHeader className="space-y-1 text-left">
							{back && (
								<Button
									variant="ghost"
									size="sm"
									className="-ml-2 h-7 w-fit gap-0.5 px-2 text-muted-foreground"
									onClick={() => setStack((s) => popView(s))}
								>
									<ChevronLeft className="h-4 w-4" />
									{back}
								</Button>
							)}
							<DialogTitle className="pr-6">
								{title.title}
								{title.subTitle && title.subTitle !== title.title && (
									<span className="ml-2 text-sm font-normal text-muted-foreground">
										{top.kind === 'stock' ? displayCode(title.subTitle) : title.subTitle}
									</span>
								)}
							</DialogTitle>
							<DialogDescription>{describe(top)}</DialogDescription>
						</DialogHeader>
						{top.kind === 'stock' ? (
							<StockDetailView key={topKey} market={top.market} stock={top.stock} />
						) : (
							<div key={topKey} className="space-y-4">
								<ChartPanelBody
									market={top.market}
									subject={top.subject}
									amountCurrency={top.amountCurrency}
								/>
								{top.subject.target === 'sector' && (
									<SectorConstituents
										market={top.market}
										code={top.subject.code}
										kind={top.sectorKind ?? 'industry'}
										onSelect={(item) =>
											setStack((s) =>
												pushView(s, {
													kind: 'stock',
													market: top.market,
													stock: { market: top.market, code: item.code, name: item.name },
												}),
											)
										}
									/>
								)}
							</div>
						)}
					</>
				)}
			</DialogContent>
		</Dialog>
	)
}
