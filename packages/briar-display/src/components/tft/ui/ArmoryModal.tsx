'use client'
import { cn } from '@/lib/utils'
import { Package } from 'lucide-react'
import { ITEM_BY_API, TRAIT_BY_API } from '../data/set18'
import { AUGMENT_BY_API } from '../data/set18/augments'
import type { PlayerState } from '../engine/types'

interface ArmoryModalProps {
	armory: NonNullable<PlayerState['armory']>
	onPick: (itemApi: string) => void
}

const POOL_LABEL: Record<string, string> = {
	artifact: '神器锻造器',
	component: '基础装备锻造器',
	completed: '成装锻造器',
	emblem: '纹章锻造器',
	radiant: '光明武器库',
	trait: '羁绊武器库',
}

/** 武器库弹窗（装备池 N 选一 + 拉克丝羁绊库，对齐海克斯三选一视觉） */
export function ArmoryModal({ armory, onPick }: ArmoryModalProps) {
	const sourceName = AUGMENT_BY_API.get(armory.source)?.name
	const title = sourceName ?? POOL_LABEL[armory.pool] ?? '武器库'
	const isTrait = armory.pool === 'trait'
	return (
		<div className="absolute inset-x-0 top-10 z-40 flex flex-col items-center">
			<div className="mb-3 flex items-center gap-2 text-lg font-black text-zinc-100">
				<Package className="h-5 w-5 text-amber-300" />
				{title} · {armory.options.length} 选一
			</div>
			<div className="flex gap-4">
				{armory.options.map((api) => {
					const opt = isTrait ? TRAIT_BY_API.get(api) : ITEM_BY_API.get(api)
					if (!opt) return null
					return (
						<button
							key={api}
							type="button"
							onClick={() => onPick(api)}
							className={cn(
								'group flex w-40 flex-col items-center rounded-xl border-2 border-amber-400/70 bg-zinc-900/95 p-3 transition-transform hover:scale-105 hover:bg-zinc-800',
								'shadow-[0_0_24px_rgba(251,191,36,0.25)]',
							)}
							title={opt.desc}
						>
							<img src={opt.icon} alt={opt.name} className="h-12 w-12 rounded-lg" />
							<span className="mt-2 text-sm font-bold text-zinc-100">{opt.name}</span>
							<span className="mt-1 line-clamp-3 text-center text-[10px] leading-relaxed text-zinc-400">
								{opt.desc.split('\n')[0]}
							</span>
						</button>
					)
				})}
			</div>
			<div className="mt-3 text-xs text-zinc-500">备战结束未选将随机获得一项</div>
		</div>
	)
}
