'use client'
import { cn } from '@/lib/utils'
import type { PlayerState } from '../engine/types'

interface PlayerListProps {
	players: PlayerState[]
	/** 当前交战对手 id（战斗阶段高亮） */
	opponentId?: number | null
	/** 正在查看棋盘的玩家 id */
	viewedId?: number
	/** 点击玩家行查看其棋盘 */
	onView?: (id: number) => void
}

/** 右侧竖排玩家列表：血量/等级/连胜连败；点击查看该玩家棋盘（对齐 TFT 实机） */
export function PlayerList({ players, opponentId = null, viewedId = 0, onView }: PlayerListProps) {
	const sorted = [...players].sort((a, b) => {
		if (a.alive !== b.alive) return a.alive ? -1 : 1
		return b.hp - a.hp
	})
	return (
		<div className="flex w-40 shrink-0 flex-col gap-1 overflow-y-auto">
			{sorted.map((p) => (
				<button
					key={p.id}
					type="button"
					onClick={() => onView?.(p.id)}
					className={cn(
						'flex flex-col rounded-md border px-2 py-1 text-left text-xs transition',
						p.id === 0 ? 'border-amber-400/70 bg-amber-950/30' : 'border-zinc-700 bg-zinc-800/60',
						p.id === opponentId && 'border-red-500/80 bg-red-950/30',
						p.id === viewedId && 'ring-2 ring-sky-400/80',
						!p.alive && 'opacity-40',
						onView && 'cursor-pointer hover:border-sky-500/60',
					)}
				>
					<div className="flex items-center justify-between gap-2">
						<span className={cn('truncate font-medium', p.id === 0 && 'text-amber-300')}>
							{p.name}
						</span>
						<span className="text-zinc-400">Lv{p.level}</span>
					</div>
					<div className="mt-0.5 flex items-center gap-1">
						<div className="h-1.5 flex-1 overflow-hidden rounded bg-zinc-700">
							<div
								className={cn('h-full', p.hp > 30 ? 'bg-green-500' : 'bg-red-500')}
								style={{ width: `${Math.max(0, p.hp)}%` }}
							/>
						</div>
						<span className="font-mono">{p.hp}</span>
					</div>
					<div className="mt-0.5 flex justify-between text-[10px] text-zinc-500">
						{p.alive ? (
							<>
								<span>{p.gold} 金</span>
								{p.streakCount >= 2 && (
									<span className={p.streakType === 'win' ? 'text-orange-400' : 'text-sky-400'}>
										{p.streakType === 'win' ? `${p.streakCount}连胜` : `${p.streakCount}连败`}
									</span>
								)}
							</>
						) : (
							<span>第 {p.placement} 名</span>
						)}
					</div>
				</button>
			))}
		</div>
	)
}
