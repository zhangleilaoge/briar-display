'use client'
import { cn } from '@/lib/utils'
import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { CombatUnitInput } from '../engine/combat'
import type { CombatRecord } from '../engine/gameLoop'
import { flipCombatRow } from '../engine/hex'
import { CombatPlayback, type PlaybackUnit } from '../engine/playback'
import type { Phase, PlayerState } from '../engine/types'
import { UnitToken } from './UnitToken'
import { BOARD_PIXEL_H, BOARD_PIXEL_W, HEX_CLIP, HEX_H, HEX_W, hexX, hexY } from './layout'

interface BoardProps {
	phase: Phase
	me: PlayerState
	record: CombatRecord | null
	playbackT: number
	/** PvE 回合备战阶段预显示的野怪波次 */
	pveWave?: CombatUnitInput[] | null
	/** 正在拖拽的类型（用于落点/可装备高亮） */
	dragKind: 'unit' | 'item' | null
	onUnitPointerDown: (e: ReactPointerEvent, uid: string) => void
}

const TOKEN_OFFSET_X = 7
const TOKEN_OFFSET_Y = 4

/** 棋盘：planning 显示己方 4 行（底部），combat 播放双方 8 行；整体按容器自适应缩放 */
export function Board({
	phase,
	me,
	record,
	playbackT,
	pveWave,
	dragKind,
	onUnitPointerDown,
}: BoardProps) {
	const playbackRef = useRef<CombatPlayback | null>(null)
	const boxRef = useRef<HTMLDivElement>(null)
	const [scale, setScale] = useState(1)

	useEffect(() => {
		const el = boxRef.current
		if (!el) return
		const update = () => {
			const r = el.getBoundingClientRect()
			setScale(Math.min(r.width / BOARD_PIXEL_W, r.height / BOARD_PIXEL_H))
		}
		update()
		const ro = new ResizeObserver(update)
		ro.observe(el)
		return () => ro.disconnect()
	}, [])

	const combat = phase === 'combat' && record
	if (!combat) playbackRef.current = null
	else if (playbackRef.current?.source !== record) playbackRef.current = new CombatPlayback(record)

	const playbackUnits =
		combat && playbackRef.current ? playbackRef.current.advanceTo(playbackT) : []
	const floats = combat && playbackRef.current ? playbackRef.current.recentFloats : []
	const shots = combat && playbackRef.current ? playbackRef.current.recentShots : []
	const flip = record?.playerSide === 'A'
	const toDisplayRow = (row: number) => (flip ? flipCombatRow(row) : row)

	const cells: React.ReactNode[] = []
	for (let row = 0; row < 8; row++) {
		for (let col = 0; col < 7; col++) {
			const own = row >= 4
			const hl = dragKind === 'unit' && own
			cells.push(
				<div
					key={`${col}-${row}`}
					className={cn(
						'absolute transition-colors',
						own ? (hl ? 'bg-emerald-500/70' : 'bg-emerald-800/50') : 'bg-zinc-600/40',
						(row + col) % 2 === 0 && (own ? (hl ? '' : 'bg-emerald-700/40') : 'bg-zinc-500/30'),
					)}
					style={{
						left: hexX(col, row),
						top: hexY(row),
						width: HEX_W,
						height: HEX_H,
						clipPath: HEX_CLIP,
					}}
					{...(own ? { 'data-hex-col': col, 'data-hex-row': row - 4 } : {})}
				>
					<div
						className={cn(
							'absolute inset-[2px]',
							own ? 'bg-emerald-950/70' : 'bg-zinc-900/80',
							(row + col) % 2 === 0 && (own ? 'bg-emerald-900/50' : 'bg-zinc-800/70'),
						)}
						style={{ clipPath: HEX_CLIP }}
					/>
				</div>,
			)
		}
	}

	return (
		<div ref={boxRef} className="relative h-full w-full select-none">
			<style>
				{
					'@keyframes tft-float { 0% { transform: translateY(0); opacity: 1 } 100% { transform: translateY(-28px); opacity: 0 } } @keyframes tft-cast-pulse { 0% { transform: scale(0.6); opacity: 0.9 } 100% { transform: scale(1.8); opacity: 0 } }'
				}
			</style>
			<div
				className="absolute"
				style={{
					width: BOARD_PIXEL_W,
					height: BOARD_PIXEL_H,
					left: '50%',
					top: '50%',
					transform: `translate(-50%, -50%) scale(${scale})`,
				}}
			>
				{cells}
				{/* PvE 备战：上半区预显示野怪（不可交互）；野怪是 B 方，战斗翻转后显示行 = 3 - 放置行 */}
				{!combat &&
					pveWave?.map((m) => (
						<div
							key={m.uid}
							className="pointer-events-none absolute opacity-80"
							style={{
								left: hexX(m.pos.col, 3 - m.pos.row) + TOKEN_OFFSET_X,
								top: hexY(3 - m.pos.row) + TOKEN_OFFSET_Y,
							}}
						>
							<UnitToken apiName={m.apiName} star={1} />
						</div>
					))}
				{!combat &&
					me.board.map((u) => {
						const row = u.pos.row + 4
						return (
							<div
								key={u.uid}
								data-hex-col={u.pos.col}
								data-hex-row={u.pos.row}
								className={cn(
									'absolute cursor-grab touch-none',
									dragKind === 'item' && 'rounded-full ring-2 ring-amber-300/80',
								)}
								style={{
									left: hexX(u.pos.col, row) + TOKEN_OFFSET_X,
									top: hexY(row) + TOKEN_OFFSET_Y,
									transition: 'left 120ms linear, top 120ms linear',
								}}
								onPointerDown={(e) => onUnitPointerDown(e, u.uid)}
							>
								<UnitToken apiName={u.apiName} star={u.star} items={u.items} />
							</div>
						)
					})}
				{combat &&
					playbackUnits.map((u) => {
						const row = toDisplayRow(u.pos.row)
						const lunge = combatLunge(u, playbackT, toDisplayRow)
						return (
							<div
								key={u.uid}
								className="absolute pointer-events-none"
								style={{
									left: hexX(u.pos.col, row) + TOKEN_OFFSET_X,
									top: hexY(row) + TOKEN_OFFSET_Y,
									transition:
										'left 120ms linear, top 120ms linear, opacity 400ms ease-in, scale 400ms ease-in',
									opacity: u.alive ? 1 : 0,
									scale: u.alive ? '1' : '0.4',
									transform: lunge ? `translate(${lunge.dx}px, ${lunge.dy}px)` : undefined,
								}}
							>
								<UnitToken
									apiName={u.apiName}
									star={u.star}
									hp={u.hp}
									maxHp={u.maxHp}
									mana={u.maxMana > 0 ? u.mana : undefined}
									maxMana={u.maxMana > 0 ? u.maxMana : undefined}
									castFlash={u.castAt >= 0 && playbackT - u.castAt < 0.35}
									attackFlash={u.attackAt >= 0 && playbackT - u.attackAt < 0.15}
								/>
								{/* 施法脉冲 */}
								{u.castAt >= 0 && playbackT - u.castAt < 0.5 && (
									<div
										className="pointer-events-none absolute inset-0 rounded-full border-2 border-cyan-300"
										style={{ animation: 'tft-cast-pulse 0.5s ease-out forwards' }}
									/>
								)}
							</div>
						)
					})}
				{/* 远程弹道 */}
				{shots.map((s) => {
					const p = Math.min(1, Math.max(0, (playbackT - s.t) / 0.28))
					const fr = toDisplayRow(s.from.row)
					const tr = toDisplayRow(s.to.row)
					const x1 = hexX(s.from.col, fr) + HEX_W / 2
					const y1 = hexY(fr) + HEX_H / 2
					const x2 = hexX(s.to.col, tr) + HEX_W / 2
					const y2 = hexY(tr) + HEX_H / 2
					return (
						<div
							key={s.key}
							className="pointer-events-none absolute h-2.5 w-2.5 rounded-full"
							style={{
								left: x1 + (x2 - x1) * p - 5,
								top: y1 + (y2 - y1) * p - 5,
								background: 'radial-gradient(circle, #fef3c7 0%, #f59e0b 60%, transparent 100%)',
								boxShadow: '0 0 6px 2px rgba(245, 158, 11, 0.7)',
							}}
						/>
					)
				})}
				{floats.map((f) => {
					const row = toDisplayRow(f.pos.row)
					return (
						<div
							key={f.key}
							className={cn(
								'absolute pointer-events-none font-bold',
								f.kind === 'heal'
									? 'text-green-400'
									: f.kind === 'shield'
										? 'text-sky-300'
										: f.crit
											? 'text-orange-400 text-lg'
											: 'text-red-300',
							)}
							style={{
								left: hexX(f.pos.col, row) + HEX_W / 2 - 10,
								top: hexY(row) + 6,
								textShadow: '0 0 4px #000',
								animation: 'tft-float 0.8s ease-out forwards',
							}}
						>
							{f.kind === 'damage' ? '-' : '+'}
							{f.value}
						</div>
					)
				})}
			</div>
		</div>
	)
}

/** 近战普攻前扑：攻击瞬间向目标格位移 35%（显示坐标系） */
function combatLunge(
	u: PlaybackUnit,
	t: number,
	toDisplayRow: (row: number) => number,
): { dx: number; dy: number } | null {
	if (u.ranged || !u.attackTo || u.attackAt < 0) return null
	if (t - u.attackAt > 0.16) return null
	const fromRow = toDisplayRow(u.pos.row)
	const toRow = toDisplayRow(u.attackTo.row)
	const dx = hexX(u.attackTo.col, toRow) - hexX(u.pos.col, fromRow)
	const dy = hexY(toRow) - hexY(fromRow)
	return { dx: dx * 0.35, dy: dy * 0.35 }
}
