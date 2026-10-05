'use client'
import { cn } from '@/lib/utils'
import { Hexagon } from 'lucide-react'
import { AUGMENT_BY_API } from '../data/set18/augments'

interface AugmentModalProps {
	offers: string[]
	/** encounter = 1-1 开局遭遇（全屏）；augment = 2-1/3-2/4-2 海克斯（浮层不挡商店） */
	mode: 'encounter' | 'augment'
	onPick: (apiName: string) => void
}

const TIER_STYLE: Record<number, { border: string; text: string; label: string }> = {
	1: { border: 'border-zinc-400', text: 'text-zinc-300', label: '白银' },
	2: { border: 'border-amber-400', text: 'text-amber-300', label: '黄金' },
	3: { border: 'border-fuchsia-400', text: 'text-fuchsia-300', label: '棱彩' },
}

/** 海克斯强化 / 开局遭遇 三选一 */
export function AugmentModal({ offers, mode, onPick }: AugmentModalProps) {
	return (
		<div
			className={cn(
				'absolute inset-x-0 z-40 flex flex-col items-center',
				mode === 'encounter' ? 'inset-y-0 justify-center bg-zinc-950/85' : 'top-10',
			)}
		>
			<div className="mb-3 flex items-center gap-2 text-lg font-black text-zinc-100">
				<Hexagon className="h-5 w-5 text-fuchsia-400" />
				{mode === 'encounter' ? '开局遭遇 · 选择恩赐' : '海克斯强化 · 三选一'}
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
			{mode === 'encounter' && (
				<div className="mt-3 text-xs text-zinc-500">超时未选将随机获得一项</div>
			)}
		</div>
	)
}
