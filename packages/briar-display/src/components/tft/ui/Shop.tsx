'use client'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Lock, LockOpen, RefreshCw, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { BUY_XP_AMOUNT, BUY_XP_COST, SHOP_REFRESH_COST } from '../data/rules'
import { CHAMPION_BY_API, TRAIT_BY_API } from '../data/set18'
import { xpNeeded } from '../engine/economy'
import type { PlayerState } from '../engine/types'
import { COST_TEXT } from './layout'

interface ShopProps {
	me: PlayerState
	maxLevel: number
	onBuy: (slot: number) => void
	onRefresh: () => void
	onBuyXp: () => void
	onToggleLock: () => void
}

/** 5 格商店 + 刷新/经验/锁定 */
export function Shop({ me, maxLevel, onBuy, onRefresh, onBuyXp, onToggleLock }: ShopProps) {
	const need = me.level >= maxLevel ? 0 : xpNeeded(me.level)
	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-center gap-2 text-sm">
				<span className="font-bold text-amber-300">🪙 {me.gold}</span>
				<span className="text-zinc-400">
					等级 {me.level}
					{me.level < maxLevel && (
						<span className="ml-1 text-xs">
							({me.xp}/{need})
						</span>
					)}
				</span>
				<div className="ml-auto flex gap-1.5">
					<Button
						size="sm"
						variant="secondary"
						onClick={onBuyXp}
						disabled={me.gold < BUY_XP_COST || me.level >= maxLevel}
						title={`花 ${BUY_XP_COST} 金买 ${BUY_XP_AMOUNT} 经验`}
					>
						<Sparkles className="mr-1 h-3.5 w-3.5" />
						{BUY_XP_COST}金 XP
					</Button>
					<Button
						size="sm"
						variant="secondary"
						onClick={onRefresh}
						disabled={me.gold < SHOP_REFRESH_COST}
					>
						<RefreshCw className="mr-1 h-3.5 w-3.5" />
						刷新 {SHOP_REFRESH_COST}金
					</Button>
					<Button
						size="sm"
						variant="ghost"
						onClick={onToggleLock}
						className="text-zinc-300"
						title="锁定商店"
					>
						{me.shopLocked ? (
							<Lock className="h-4 w-4 text-amber-400" />
						) : (
							<LockOpen className="h-4 w-4" />
						)}
					</Button>
				</div>
			</div>
			<div className="flex gap-1.5">
				{me.shop.map((apiName, i) => {
					const c = apiName ? CHAMPION_BY_API.get(apiName) : null
					const affordable = c ? me.gold >= c.cost : false
					return (
						<button
							key={apiName ? `${apiName}@${i}` : `empty-${i}`}
							type="button"
							disabled={!c || !affordable}
							onClick={() => {
								if (c && affordable) onBuy(i)
								else if (c) toast.error('金币不足')
							}}
							className={cn(
								'group relative flex w-24 flex-col overflow-hidden rounded-md border bg-zinc-800 text-left transition',
								c ? 'border-zinc-600 hover:border-amber-400' : 'border-zinc-800 opacity-30',
								c && !affordable && 'opacity-60',
							)}
						>
							{c && (
								<>
									<img
										src={c.icon}
										alt={c.name}
										className="h-16 w-full object-cover"
										draggable={false}
									/>
									<div className="flex flex-col px-1 py-0.5">
										<span className="truncate text-xs text-zinc-100">{c.name}</span>
										<span className={cn('text-xs font-bold', COST_TEXT[c.cost])}>{c.cost} 金</span>
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
													className="h-4 w-4 rounded-full border border-zinc-900 bg-zinc-900"
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
										<div className="mt-1 whitespace-pre-wrap leading-relaxed">{c.ability.desc}</div>
									</div>
								</>
							)}
						</button>
					)
				})}
			</div>
		</div>
	)
}
