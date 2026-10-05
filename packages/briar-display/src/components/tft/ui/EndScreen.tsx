'use client'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Crown } from 'lucide-react'
import type { PlayerState } from '../engine/types'

interface EndScreenProps {
	players: PlayerState[]
	onRestart: () => void
	onLobby: () => void
}

/** 结算面板 */
export function EndScreen({ players, onRestart, onLobby }: EndScreenProps) {
	const sorted = [...players].sort((a, b) => a.placement - b.placement)
	const me = players[0]
	return (
		<div className="absolute inset-0 z-40 flex items-center justify-center bg-black/75">
			<div className="w-96 rounded-xl border border-zinc-600 bg-zinc-900 p-6">
				<div className="text-center">
					<div className="text-sm text-zinc-400">本局排名</div>
					<div
						className={cn(
							'mt-1 text-4xl font-black',
							me.placement === 1 ? 'text-amber-300' : 'text-zinc-100',
						)}
					>
						#{me.placement}
					</div>
					{me.placement === 1 && (
						<div className="mt-1 flex items-center justify-center gap-1 text-amber-300">
							<Crown className="h-4 w-4" /> 吃鸡！
						</div>
					)}
				</div>
				<div className="mt-4 flex flex-col gap-1">
					{sorted.map((p) => (
						<div
							key={p.id}
							className={cn(
								'flex items-center rounded px-2 py-1 text-sm',
								p.id === 0 ? 'bg-amber-950/50 text-amber-200' : 'text-zinc-300',
							)}
						>
							<span className="w-8 font-mono text-zinc-500">#{p.placement}</span>
							<span className="flex-1 truncate">{p.name}</span>
							<span className="text-xs text-zinc-500">Lv{p.level}</span>
						</div>
					))}
				</div>
				<div className="mt-5 flex gap-2">
					<Button className="flex-1" onClick={onRestart}>
						再来一局
					</Button>
					<Button variant="secondary" className="flex-1" onClick={onLobby}>
						返回大厅
					</Button>
				</div>
			</div>
		</div>
	)
}
