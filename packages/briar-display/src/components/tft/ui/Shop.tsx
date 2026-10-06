'use client'
import { cn } from '@/lib/utils'
import { Coins, Flame } from 'lucide-react'
import { toast } from 'sonner'
import { sellPriceOf } from '../data/rules'
import { CHAMPION_BY_API, TRAIT_BY_API } from '../data/set18'
import { formatTftDesc } from '../data/set18/descFormat'
import type { PlayerState } from '../engine/types'
import { costOf } from '../engine/units'
import { COST_BORDER, COST_TEXT } from './layout'

interface ShopProps {
	me: PlayerState
	/** 拖拽中的棋子：商店区整体变为出售条（对齐实机 Sell for Xg） */
	sellUnit?: { apiName: string; star: number } | null
	onBuy: (slot: number) => void
}

/** 底部 5 格商店：费色边框卡牌；拖棋子时替换为出售条 */
export function Shop({ me, sellUnit, onBuy }: ShopProps) {
	if (sellUnit) {
		const price = sellPriceOf(costOf(sellUnit.apiName), sellUnit.star)
		return (
			<div
				data-sell-zone
				className="flex h-[5.5rem] w-[36rem] max-w-full items-center justify-center rounded-lg border-2 border-dashed border-red-500/70 bg-red-950/40 text-lg font-black tracking-[0.3em] text-red-200"
			>
				出售 +{price} 金
			</div>
		)
	}
	return (
		<div className="flex gap-1.5">
			{me.shop.map((apiName, i) => {
				const c = apiName ? CHAMPION_BY_API.get(apiName) : null
				const affordable = c ? me.gold >= c.cost : false
				const ignited = me.ignitedSlots.includes(i)
				return (
					<button
						key={apiName ? `${apiName}@${i}` : `empty-${i}`}
						type="button"
						disabled={!c || !affordable}
						onClick={() => {
							if (c && affordable) onBuy(i)
							else if (c) toast.error('金币不足')
						}}
						title={ignited ? '地狱火引燃：刷新出高一费棋子' : undefined}
						className={cn(
							'group relative flex w-28 flex-col overflow-hidden rounded-md border-2 bg-zinc-900 text-left transition',
							c ? COST_BORDER[c.cost] : 'border-zinc-800/60 opacity-30',
							ignited && 'border-orange-500 shadow-[0_0_14px_rgba(249,115,22,0.55)] brightness-110',
							c && affordable && 'hover:scale-[1.03] hover:brightness-125',
							c && !affordable && 'opacity-50 saturate-50',
						)}
					>
						{c && (
							<>
								<img
									src={c.icon}
									alt={c.name}
									className="h-20 w-full object-cover"
									draggable={false}
								/>
								{ignited && (
									<span className="absolute left-0.5 top-0.5 rounded-full bg-orange-950/80 p-0.5">
										<Flame className="h-3.5 w-3.5 text-orange-400" />
									</span>
								)}
								{/* 底部名字 + 费用（渐变压条，对齐实机） */}
								<div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-1 bg-gradient-to-t from-black/95 via-black/60 to-transparent px-1.5 pb-0.5 pt-4">
									<span className="truncate text-xs font-bold text-zinc-100">{c.name}</span>
									<span
										className={cn(
											'flex shrink-0 items-center gap-0.5 text-xs font-black',
											COST_TEXT[c.cost],
										)}
									>
										<Coins className="h-3 w-3 text-amber-300" />
										{c.cost}
									</span>
								</div>
								<div className="absolute right-0.5 top-0.5 flex flex-col gap-0.5">
									{c.traits.map((t) => {
										const tr = TRAIT_BY_API.get(t)
										return tr ? (
											<img
												key={t}
												src={tr.icon}
												alt={tr.name}
												title={tr.name}
												className="h-4 w-4 rounded-full border border-black/70 bg-zinc-900/90"
											/>
										) : null
									})}
								</div>
								{/* hover 技能说明 */}
								<div className="pointer-events-none absolute bottom-full left-0 z-50 mb-1 hidden w-56 rounded-md border border-zinc-600 bg-zinc-900/95 p-2 text-xs text-zinc-300 group-hover:block">
									<div className="font-bold text-zinc-100">
										{c.ability.name}
										<span className="ml-1 text-cyan-300">
											{c.stats.initialMana}/{c.stats.mana}
										</span>
									</div>
									<div className="mt-1 whitespace-pre-wrap leading-relaxed">
										{formatTftDesc(c.ability.desc, c.ability.vars)}
									</div>
								</div>
							</>
						)}
					</button>
				)
			})}
		</div>
	)
}
