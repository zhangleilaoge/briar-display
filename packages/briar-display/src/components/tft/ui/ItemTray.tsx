'use client'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { ITEM_TRAY_SIZE } from '../data/rules'
import { ITEMS } from '../data/set18'
import { anyItemByApi, isConsumable } from '../data/set18/consumables'
import { formatTftDesc } from '../data/set18/descFormat'
import type { SetItem } from '../data/set18/types'

interface ItemTrayProps {
	items: string[]
	onItemPointerDown: (e: ReactPointerEvent, itemApi: string) => void
}

const ItemIcon = ({ api, className }: { api: string; className?: string }) => {
	const item = anyItemByApi(api)
	return (
		<img
			src={item?.icon}
			alt={item?.name ?? api}
			className={className ?? 'h-5 w-5 rounded-sm border border-zinc-600 bg-zinc-900'}
			draggable={false}
		/>
	)
}

/** 悬停浮层：散件列出全部合成路线，成件显示配方与效果（属性面板装备格复用） */
export function ItemTooltip({ item }: { item: SetItem }) {
	const desc = formatTftDesc(item.desc, item.effects)
	const recipes =
		item.isComponent && !isConsumable(item.apiName)
			? // 腐化装无正常合成产出途径，不列入合成路线
				ITEMS.filter(
					(it) => !it.apiName.includes('Corrupted') && it.composition.includes(item.apiName),
				)
			: []
	return (
		<div className="pointer-events-none absolute bottom-full right-0 z-50 mb-2 hidden w-80 rounded-lg border border-zinc-600 bg-zinc-900/95 p-2.5 shadow-xl group-hover:block">
			<div className="flex items-center gap-2">
				<ItemIcon api={item.apiName} className="h-7 w-7 rounded border border-zinc-600" />
				<div>
					<div className="text-xs font-bold text-zinc-100">{item.name}</div>
					<div className="text-[10px] text-zinc-500">
						{isConsumable(item.apiName) ? '消耗品' : item.isComponent ? '基础装备' : '成装'}
					</div>
				</div>
			</div>
			{desc && <div className="mt-1.5 text-[11px] leading-relaxed text-zinc-400">{desc}</div>}
			{!item.isComponent && item.composition.length > 0 && (
				<div className="mt-1.5 flex items-center gap-1 text-[10px] text-zinc-500">
					合成：
					<ItemIcon api={item.composition[0]} />
					+
					<ItemIcon api={item.composition[1] ?? item.composition[0]} />
				</div>
			)}
			{recipes.length > 0 && (
				<div className="mt-2 border-t border-zinc-700/60 pt-1.5">
					<div className="mb-1 text-[10px] font-bold text-zinc-500">可合成</div>
					<div className="grid grid-cols-2 gap-x-2 gap-y-1">
						{recipes.map((r) => {
							const partner = r.composition.find((c) => c !== item.apiName) ?? item.apiName
							return (
								<div key={r.apiName} className="flex items-center gap-1" title={r.name}>
									<ItemIcon api={partner} className="h-4 w-4 shrink-0 rounded-sm" />
									<span className="shrink-0 text-[10px] text-zinc-500">→</span>
									<ItemIcon api={r.apiName} className="h-4 w-4 shrink-0 rounded-sm" />
									<span className="whitespace-nowrap text-[10px] text-zinc-400">{r.name}</span>
								</div>
							)
						})}
					</div>
				</div>
			)}
		</div>
	)
}

/** 装备栏：拖到棋子上穿戴/使用，两件散件在棋子身上自动合成；悬停显示合成路线（右下 5x2 网格，对齐实机） */
export function ItemTray({ items, onItemPointerDown }: ItemTrayProps) {
	return (
		<div className="grid shrink-0 grid-cols-5 gap-1">
			{Array.from({ length: ITEM_TRAY_SIZE }, (_, i) => {
				const apiName = items[i]
				const item = apiName ? anyItemByApi(apiName) : null
				return (
					<div
						key={apiName ?? i}
						className="group relative flex h-9 w-9 items-center justify-center rounded border border-zinc-700/70 bg-zinc-900/70"
					>
						{item && apiName && (
							<>
								<img
									src={item.icon}
									alt={item.name}
									className="h-7 w-7 cursor-grab touch-none rounded-sm"
									draggable={false}
									onPointerDown={(e) => onItemPointerDown(e, apiName)}
								/>
								<ItemTooltip item={item} />
							</>
						)}
					</div>
				)
			})}
		</div>
	)
}
