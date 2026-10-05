'use client'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { ITEM_TRAY_SIZE } from '../data/rules'
import { ITEM_BY_API } from '../data/set18'

interface ItemTrayProps {
	items: string[]
	onItemPointerDown: (e: ReactPointerEvent, itemApi: string) => void
}

/** 装备栏：拖到棋子上穿戴，两件散件在棋子身上自动合成 */
export function ItemTray({ items, onItemPointerDown }: ItemTrayProps) {
	return (
		<div className="flex gap-1">
			{Array.from({ length: ITEM_TRAY_SIZE }, (_, i) => {
				const apiName = items[i]
				const item = apiName ? ITEM_BY_API.get(apiName) : null
				return (
					<div
						key={apiName ?? i}
						className="flex h-9 w-9 items-center justify-center rounded border border-zinc-700 bg-zinc-800/60"
					>
						{item && apiName && (
							<img
								src={item.icon}
								alt={item.name}
								title={`${item.name}\n${item.desc}`}
								className="h-7 w-7 cursor-grab touch-none rounded-sm"
								draggable={false}
								onPointerDown={(e) => onItemPointerDown(e, apiName)}
							/>
						)}
					</div>
				)
			})}
		</div>
	)
}
