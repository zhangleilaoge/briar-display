'use client'
import { cn } from '@/lib/utils'
import { Hexagon } from 'lucide-react'
import { AUGMENT_BY_API } from '../data/set18/augments'

interface AugmentModalProps {
	offers: string[]
	onPick: (apiName: string) => void
}

const TIER_STYLE: Record<number, { border: string; text: string; label: string; glow: string }> = {
	1: {
		border: 'border-zinc-400',
		text: 'text-zinc-300',
		label: '白银',
		glow: 'shadow-[0_0_28px_rgba(212,212,216,0.18)]',
	},
	2: {
		border: 'border-amber-400',
		text: 'text-amber-300',
		label: '黄金',
		glow: 'shadow-[0_0_28px_rgba(251,191,36,0.3)]',
	},
	3: {
		border: 'border-fuchsia-400',
		text: 'text-fuchsia-300',
		label: '棱彩',
		glow: 'shadow-[0_0_32px_rgba(232,121,249,0.35)]',
	},
}

/** 海克斯强化三选一（2-1/3-2/4-2 备战阶段浮层，不挡商店） */
export function AugmentModal({ offers, onPick }: AugmentModalProps) {
	const tier = TIER_STYLE[AUGMENT_BY_API.get(offers[0] ?? '')?.tier ?? 2]
	return (
		<div className="absolute inset-x-0 top-10 z-40 flex flex-col items-center">
			<div className="mb-3 flex items-center gap-2 text-lg font-black text-zinc-100">
				<Hexagon className="h-5 w-5 text-fuchsia-400" />
				海克斯强化 · 三选一
				<span className={cn('rounded border px-1.5 py-0.5 text-xs', tier.border, tier.text)}>
					本轮{tier.label}
				</span>
			</div>
			<div className="flex gap-4">
				{offers.map((api) => {
					const aug = AUGMENT_BY_API.get(api)
					if (!aug) return null
					const t = TIER_STYLE[aug.tier]
					return (
						<button
							key={api}
							type="button"
							onClick={() => onPick(api)}
							className={cn(
								'flex w-52 flex-col items-center rounded-xl border-2 bg-zinc-900/95 p-4 transition-transform hover:scale-105 hover:bg-zinc-800',
								t.border,
								t.glow,
							)}
						>
							<span className={cn('text-[10px] font-bold', t.text)}>{t.label}</span>
							<span className="mt-1 text-base font-bold text-zinc-100">{aug.name}</span>
							<span className="mt-2 text-center text-xs leading-relaxed text-zinc-400">
								{aug.desc}
							</span>
						</button>
					)
				})}
			</div>
			<div className="mt-3 text-xs text-zinc-500">备战结束未选将随机获得一项</div>
		</div>
	)
}
