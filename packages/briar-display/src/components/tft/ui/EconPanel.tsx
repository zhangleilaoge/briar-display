'use client'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ChevronUp, Coins, Flame, Lock, LockOpen, RefreshCw } from 'lucide-react'
import { BUY_XP_AMOUNT, BUY_XP_COST, MAX_LEVEL, SHOP_ODDS, SHOP_REFRESH_COST } from '../data/rules'
import { xpNeeded } from '../engine/economy'
import type { PlayerState } from '../engine/types'
import { COST_TEXT } from './layout'

interface EconPanelProps {
	me: PlayerState
	onRefresh: () => void
	onBuyXp: () => void
	onToggleLock: () => void
}

/** 左下经济簇：等级/经验/商店概率/金币/连胜 + 买经验/刷新/锁定（对齐实机左下角信息条） */
export function EconPanel({ me, onRefresh, onBuyXp, onToggleLock }: EconPanelProps) {
	const maxed = me.level >= MAX_LEVEL
	const need = maxed ? 0 : xpNeeded(me.level)
	const odds = SHOP_ODDS[me.level] ?? SHOP_ODDS[1]
	const freeRefresh = me.freeRerolls > 0
	return (
		<div className="flex shrink-0 flex-col justify-end gap-1.5">
			{/* 信息条：Lvl + 经验 + 各费概率 + 金币 + 连胜 */}
			<div className="flex items-center gap-2 rounded-md border border-zinc-700/50 bg-black/45 px-2.5 py-1.5 text-xs backdrop-blur-sm">
				<span className="font-black text-zinc-100">Lvl. {me.level}</span>
				<span className="text-zinc-500">{maxed ? 'MAX' : `${me.xp}/${need}`}</span>
				<span className="h-3 w-px bg-zinc-700" />
				<div className="flex items-center gap-1">
					{odds.map((o, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: 概率表按费用固定 5 格
						<span key={i} className={cn('font-mono', o > 0 ? COST_TEXT[i + 1] : 'text-zinc-600')}>
							{o}%
						</span>
					))}
				</div>
				<span className="h-3 w-px bg-zinc-700" />
				<span className="flex items-center gap-1 text-sm font-black text-amber-300">
					<Coins className="h-3.5 w-3.5" />
					{me.gold}
				</span>
				{me.streakCount >= 2 && (
					<span
						className={cn(
							'flex items-center gap-0.5 font-bold',
							me.streakType === 'win' ? 'text-orange-400' : 'text-sky-400',
						)}
					>
						<Flame className="h-3.5 w-3.5" />
						{me.streakCount}
						{me.streakType === 'win' ? '连胜' : '连败'}
					</span>
				)}
			</div>
			{/* 操作按钮 */}
			<div className="flex gap-1.5">
				<Button
					size="sm"
					variant="secondary"
					className="h-8 flex-1 border border-zinc-600/60 bg-zinc-800/80 text-xs hover:bg-zinc-700"
					onClick={onBuyXp}
					disabled={me.gold < BUY_XP_COST || maxed}
					title={`花 ${BUY_XP_COST} 金买 ${BUY_XP_AMOUNT} 经验`}
				>
					<ChevronUp className="mr-1 h-4 w-4 text-sky-300" />
					买经验 {BUY_XP_COST}金
				</Button>
				<Button
					size="sm"
					variant="secondary"
					className="h-8 flex-1 border border-zinc-600/60 bg-zinc-800/80 text-xs hover:bg-zinc-700"
					onClick={onRefresh}
					disabled={!freeRefresh && me.gold < SHOP_REFRESH_COST}
					title="刷新商店"
				>
					<RefreshCw className="mr-1 h-4 w-4 text-amber-300" />
					{freeRefresh ? `免费 x${me.freeRerolls}` : `刷新 ${SHOP_REFRESH_COST}金`}
				</Button>
				<Button
					size="sm"
					variant="secondary"
					className="h-8 border border-zinc-600/60 bg-zinc-800/80 px-2 text-zinc-300 hover:bg-zinc-700"
					onClick={onToggleLock}
					title="锁定商店（下回合不自动刷新）"
				>
					{me.shopLocked ? (
						<Lock className="h-4 w-4 text-amber-400" />
					) : (
						<LockOpen className="h-4 w-4" />
					)}
				</Button>
			</div>
		</div>
	)
}
