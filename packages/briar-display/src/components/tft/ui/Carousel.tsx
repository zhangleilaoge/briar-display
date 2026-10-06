'use client'
import { cn } from '@/lib/utils'
import { CHAMPION_BY_API, ITEM_BY_API } from '../data/set18'
import type { GameState } from '../engine/types'
import { COST_BORDER } from './layout'

interface CarouselProps {
	state: GameState
	onPick: (slotIndex: number) => void
}

/** 选秀：按血量倒序轮流选取 */
export function Carousel({ state, onPick }: CarouselProps) {
	const pickerId = state.carouselQueue[state.currentPickerIndex]
	const isMyTurn = pickerId === 0
	const remain = Math.max(0, Math.ceil((state.pickEndsAt - state.gameTime) / 1000))
	return (
		<div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/70">
			<div className="mb-4 text-center">
				<div className="text-xl font-bold text-zinc-100">共享选秀</div>
				<div className="mt-1 text-sm text-zinc-400">
					{isMyTurn ? (
						<span className="font-bold text-amber-300">轮到你了！点击选取（{remain}s）</span>
					) : (
						<>
							等待 <span className="text-zinc-200">{state.players[pickerId]?.name}</span> 选择…{' '}
							{remain}s
						</>
					)}
				</div>
			</div>
			<div className="flex gap-3">
				{state.carousel.map((slot, i) => {
					const c = CHAMPION_BY_API.get(slot.apiName)
					const item = ITEM_BY_API.get(slot.item)
					return (
						<button
							key={`${slot.apiName}@${i}`}
							type="button"
							disabled={!isMyTurn}
							onClick={() => onPick(i)}
							className={cn(
								'flex w-20 flex-col items-center rounded-lg border-2 bg-zinc-800 p-1.5 transition',
								COST_BORDER[c?.cost ?? 1],
								isMyTurn ? 'hover:scale-110 hover:border-amber-300' : 'opacity-70',
							)}
						>
							<img
								src={c?.icon}
								alt={c?.name}
								className="h-14 w-14 rounded-md object-cover"
								draggable={false}
							/>
							<span className="mt-1 w-full truncate text-center text-xs text-zinc-100">
								{c?.name}
							</span>
							{item && (
								<span className="mt-0.5 flex items-center gap-1 text-[10px] text-zinc-400">
									<img src={item.icon} alt={item.name} className="h-3.5 w-3.5 rounded-sm" />
									{item.name}
								</span>
							)}
						</button>
					)
				})}
			</div>
		</div>
	)
}
