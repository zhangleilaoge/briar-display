'use client'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { PlayerState } from '../engine/types'
import { UnitToken } from './UnitToken'

interface BenchProps {
	me: PlayerState
	onUnitPointerDown: (e: ReactPointerEvent, uid: string) => void
}

/** 9 格备战席 */
export function Bench({ me, onUnitPointerDown }: BenchProps) {
	return (
		<div className="flex gap-1.5">
			{me.bench.map((u, i) => (
				<div
					key={u?.uid ?? i}
					data-bench-index={i}
					className="flex h-16 w-16 items-center justify-center rounded-md border border-zinc-700 bg-zinc-800/60"
				>
					{u && (
						<div
							className="cursor-grab touch-none"
							onPointerDown={(e) => onUnitPointerDown(e, u.uid)}
						>
							<UnitToken apiName={u.apiName} star={u.star} items={u.items} size={52} />
						</div>
					)}
				</div>
			))}
		</div>
	)
}
