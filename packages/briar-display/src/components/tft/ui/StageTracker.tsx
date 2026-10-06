'use client'
import { cn } from '@/lib/utils'
import { Gem, Sparkles, Store, Swords } from 'lucide-react'
import { STAGE1_ROUNDS, STAGE_ROUNDS, isAugmentRound, roundType } from '../data/rules'
import { pveWaveIcon } from '../data/set18/monsters'

interface StageTrackerProps {
	stage: number
	round: number
}

const TYPE_LABEL = { encounter: '遭遇', pve: 'PvE', carousel: '选秀', pvp: 'PvP' } as const

/** 顶部轮次指示器：当前阶段各回合图标轨道，当前回合高亮，hover 显示回合说明 */
export function StageTracker({ stage, round }: StageTrackerProps) {
	const total = stage === 1 ? STAGE1_ROUNDS : STAGE_ROUNDS
	return (
		<div className="flex items-center gap-1">
			{Array.from({ length: total }, (_, i) => i + 1).map((r) => {
				const type = roundType(stage, r)
				const augment = isAugmentRound(stage, r)
				const current = r === round
				const past = r < round
				const pve = type === 'pve' ? pveWaveIcon(stage, r) : null
				return (
					<div
						key={r}
						className={cn(
							'group relative flex h-7 w-7 items-center justify-center rounded-md border',
							current
								? 'border-amber-400 bg-amber-500/20 text-amber-200'
								: past
									? 'border-zinc-700 bg-zinc-800/60 text-zinc-500'
									: 'border-zinc-700/60 bg-zinc-900/60 text-zinc-400',
						)}
					>
						{type === 'encounter' && <Sparkles className="h-3.5 w-3.5" />}
						{type === 'carousel' && <Store className="h-3.5 w-3.5" />}
						{type === 'pvp' && <Swords className="h-3.5 w-3.5" />}
						{pve && (
							<img
								src={pve.icon}
								alt={pve.label}
								className="h-5 w-5 rounded-sm object-cover"
								draggable={false}
							/>
						)}
						{augment && <Gem className="absolute -right-1 -top-1 h-3 w-3 text-fuchsia-400" />}
						{/* hover 回合说明 */}
						<div className="pointer-events-none absolute left-1/2 top-full z-50 mt-1 hidden -translate-x-1/2 whitespace-nowrap rounded border border-zinc-600 bg-zinc-900/95 px-2 py-1 text-[10px] text-zinc-300 group-hover:block">
							{stage}-{r} {TYPE_LABEL[type]}
							{pve ? `（${pve.label}）` : ''}
							{augment ? ' · 海克斯强化' : ''}
						</div>
					</div>
				)
			})}
		</div>
	)
}
