import type { MarketId, SectorKind, StockRef } from '@briar/shared'
import type { ChartSubject } from './MarketChartPanel'

/**
 * 详情弹窗的导航栈：板块 → 个股 → 返回。
 * 纯函数（便于单测），组件里用 useState 持有栈。
 */
export type DetailView =
	| {
			kind: 'chart'
			market: MarketId
			subject: ChartSubject
			amountCurrency?: string
			/** 板块类别（韩国业种/主题编号会重复，查成分股要带） */
			sectorKind?: SectorKind
	  }
	| { kind: 'stock'; market: MarketId; stock: StockRef }

export const viewKey = (v: DetailView) =>
	v.kind === 'stock'
		? `stock:${v.market}:${v.stock.code}`
		: `${v.subject.target}:${v.market}:${v.subject.code}`

/** 打开新弹窗：栈重置为这一层 */
export const openStack = (view: DetailView | null): DetailView[] => (view ? [view] : [])

/**
 * 进入下一层：与栈顶相同不重复压栈；已在栈里（如 A→B 后又点 A）就回到那一层，避免无限加深
 */
export function pushView(stack: DetailView[], view: DetailView): DetailView[] {
	const key = viewKey(view)
	const idx = stack.findIndex((v) => viewKey(v) === key)
	if (idx >= 0) return stack.slice(0, idx + 1)
	return [...stack, view]
}

/** 返回上一层；只剩一层时不动（关闭由弹窗自己处理） */
export const popView = (stack: DetailView[]): DetailView[] =>
	stack.length > 1 ? stack.slice(0, -1) : stack

export const topView = (stack: DetailView[]): DetailView | null => stack[stack.length - 1] ?? null

/** 标题：当前层名称；副标题：板块 / 指数 / 个股 + 市场 */
export function viewTitle(view: DetailView): { title: string; subTitle?: string } {
	if (view.kind === 'stock') return { title: view.stock.name, subTitle: view.stock.code }
	return { title: view.subject.name, subTitle: view.subject.subName }
}

/** 返回按钮文案：「返回 医药生物」 */
export function backLabel(stack: DetailView[]): string | null {
	if (stack.length < 2) return null
	return `返回 ${viewTitle(stack[stack.length - 2]).title}`
}
