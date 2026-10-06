'use client'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { PlayerState } from '../engine/types'
import { UnitToken } from './UnitToken'
import { HEX_CLIP } from './layout'

interface BenchProps {
	me: PlayerState
	/** 拖拽中的棋子：同名同星棋子高亮（合成提示） */
	dragUnit?: { apiName: string; star: number; uid: string } | null
	onUnitPointerDown: (e: ReactPointerEvent, uid: string) => void
}

/** 9 格备战席 */
export function Bench({ me, dragUnit, onUnitPointerDown }: BenchProps) {
	return (
		<div className="flex gap-1.5">
			{me.bench.map((u, i) => (
				<div
					key={u?.uid ?? i}
					data-bench-index={i}
					className="flex h-16 w-16 items-center justify-center rounded-lg border border-cyan-900/50 bg-slate-900/50"
				>
					{u && (
						<div
							className="relative cursor-grab touch-none"
							onPointerDown={(e) => onUnitPointerDown(e, u.uid)}
						>
							<UnitToken
								apiName={u.apiName}
								star={u.star}
								items={u.items}
								size={52}
								chosenTrait={u.chosenTrait}
							/>
							{dragUnit &&
								u.uid !== dragUnit.uid &&
								u.apiName === dragUnit.apiName &&
								u.star === dragUnit.star && (
									<div
										className="pointer-events-none absolute inset-0 animate-pulse bg-amber-300/40"
										style={{ clipPath: HEX_CLIP }}
									/>
								)}
						</div>
					)}
				</div>
			))}
		</div>
	)
}
