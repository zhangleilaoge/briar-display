'use client'
import { cn } from '@/lib/utils'
import { Hexagon } from 'lucide-react'
import { AUGMENT_BY_API } from '../data/set18/augments'
import type { PlayerState } from '../engine/types'

const TIER_RING = ['', 'border-zinc-400/80', 'border-amber-400/90', 'border-fuchsia-400/90']
const TIER_TEXT = ['', 'text-zinc-300', 'text-amber-300', 'text-fuchsia-300']

/** 已选海克斯/遭遇栏：品质色六边形图标，hover 显示名称与描述 */
export function AugmentBar({ player }: { player: PlayerState }) {
	if (player.augments.length === 0) return null
	return (
		<div className="flex gap-1.5 px-1 pt-1">
			{player.augments.map((api) => {
				const def = AUGMENT_BY_API.get(api)
				if (!def) return null
				return (
					<div key={api} className="group relative">
						<div
							className={cn(
								'flex h-9 w-9 items-center justify-center rounded-md border-2 bg-zinc-900/80',
								TIER_RING[def.tier],
							)}
						>
							<Hexagon className={cn('h-5 w-5', TIER_TEXT[def.tier])} />
						</div>
						<div className="pointer-events-none absolute left-0 top-full z-50 mt-1 hidden w-64 rounded-md border border-zinc-600 bg-zinc-900/95 p-2 group-hover:block">
							<div className={cn('text-xs font-bold', TIER_TEXT[def.tier])}>{def.name}</div>
							<div className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed text-zinc-400">
								{def.desc}
							</div>
						</div>
					</div>
				)
			})}
		</div>
	)
}
