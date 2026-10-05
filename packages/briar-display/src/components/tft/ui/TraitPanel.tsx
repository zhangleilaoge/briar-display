'use client'
import { cn } from '@/lib/utils'
import { TRAIT_BY_API } from '../data/set18'
import { traitCounts } from '../engine/traits'
import type { PlayerState } from '../engine/types'

/** 左侧羁绊面板：激活高亮 + 未激活进度 */
export function TraitPanel({ me }: { me: PlayerState }) {
	const counts = traitCounts(me.board)
	const rows = [...counts.entries()]
		.map(([apiName, count]) => {
			const def = TRAIT_BY_API.get(apiName)
			if (!def) return null
			let active = -1
			for (let i = 0; i < def.breakpoints.length; i++) {
				if (count >= def.breakpoints[i]) active = i
			}
			return { apiName, count, def, active }
		})
		.filter((r): r is NonNullable<typeof r> => r !== null)
		.sort((a, b) => b.active - a.active || b.count - a.count)

	return (
		<div className="flex w-44 shrink-0 flex-col gap-1 overflow-y-auto py-1">
			{rows.length === 0 && <div className="text-xs text-zinc-500">上场棋子以激活羁绊</div>}
			{rows.map(({ apiName, count, def, active }) => {
				const next = def.breakpoints[active + 1]
				return (
					<div
						key={apiName}
						className={cn(
							'group relative flex items-center gap-1.5 rounded-md border px-1.5 py-1 text-xs',
							active >= 0
								? 'border-amber-500/60 bg-amber-950/40 text-zinc-100'
								: 'border-zinc-700/60 bg-zinc-800/40 text-zinc-400',
						)}
					>
						<img src={def.icon} alt={def.name} className="h-5 w-5 rounded-full" draggable={false} />
						<span className="truncate">{def.name}</span>
						<span className="ml-auto font-mono">
							{count}
							{next !== undefined && <span className="text-zinc-500">/{next}</span>}
						</span>
						<div className="pointer-events-none absolute left-full top-0 z-50 ml-1 hidden w-64 rounded-md border border-zinc-600 bg-zinc-900/95 p-2 leading-relaxed group-hover:block">
							<div className="font-bold text-zinc-100">
								{def.name}（{def.breakpoints.join(' / ')}）
							</div>
							<div className="mt-1 whitespace-pre-wrap">{def.desc}</div>
						</div>
					</div>
				)
			})}
		</div>
	)
}
