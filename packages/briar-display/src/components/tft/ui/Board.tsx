'use client'
import { cn } from '@/lib/utils'
import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { CHAMPION_BY_API } from '../data/set18'
import { MONSTER_BY_API } from '../data/set18/monsters'
import type { CombatUnitInput } from '../engine/combat'
import { flipCombatRow, hexesInRange } from '../engine/hex'
import { CombatPlayback, type PlaybackUnit } from '../engine/playback'
import type { CombatRecord } from '../engine/types'
import type { Phase, PlayerState } from '../engine/types'
import { UnitToken } from './UnitToken'
import { BOARD_PIXEL_H, BOARD_PIXEL_W, HEX_CLIP, HEX_H, HEX_W, hexX, hexY } from './layout'

/** 3D 棋盘倾角：容器透视 + 棋盘绕 X 轴前倾，棋子反向竖直（billboard） */
const TILT_DEG = 40
const COS_TILT = Math.cos((TILT_DEG * Math.PI) / 180)
/** 棋子反向旋转竖立（origin 定在棋子底边，站立在格子平面上） */
const STAND = `rotateX(${-TILT_DEG}deg)`

interface BoardProps {
	phase: Phase
	me: PlayerState
	record: CombatRecord | null
	playbackT: number
	/** PvE 回合备战阶段预显示的野怪波次 */
	pveWave?: CombatUnitInput[] | null
	/** 正在拖拽的类型（用于落点/可装备高亮） */
	dragKind: 'unit' | 'item' | null
	/** 拖拽中的棋子：同名同星棋子高亮（合成提示） */
	dragUnit?: { apiName: string; star: number; uid: string } | null
	onUnitPointerDown: (e: ReactPointerEvent, uid: string) => void
	/** 战斗阶段点击棋子（查看属性） */
	onCombatUnitClick?: (uid: string) => void
}

/** 棋盘：planning 显示己方 4 行（底部），combat 播放双方 8 行；整体按容器自适应缩放 */
export function Board({
	phase,
	me,
	record,
	playbackT,
	pveWave,
	dragKind,
	dragUnit,
	onUnitPointerDown,
	onCombatUnitClick,
}: BoardProps) {
	const playbackRef = useRef<CombatPlayback | null>(null)
	const boxRef = useRef<HTMLDivElement>(null)
	const [scale, setScale] = useState(1)

	useEffect(() => {
		const el = boxRef.current
		if (!el) return
		const update = () => {
			const r = el.getBoundingClientRect()
			// 前倾后棋盘投影高度 = H·cos(θ)，另加顶部棋子竖立出头的余量
			setScale(
				Math.min(r.width / BOARD_PIXEL_W, r.height / (BOARD_PIXEL_H * COS_TILT + HEX_H * 0.7)),
			)
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
	const casts = combat && playbackRef.current ? playbackRef.current.recentCasts : []
	const flip = record?.playerSide === 'A'
	const toDisplayRow = (row: number) => (flip ? flipCombatRow(row) : row)

	const cells: React.ReactNode[] = []
	for (let row = 0; row < 8; row++) {
		for (let col = 0; col < 7; col++) {
			const own = row >= 4
			const hl = dragKind === 'unit' && own
			// 填充式六边形（对齐实机深色棋盘：己方暗绿、敌方暗灰，拖拽时己方格提亮）
			const fill = own
				? hl
					? 'bg-emerald-400/40'
					: (row + col) % 2 === 0
						? 'bg-emerald-500/25'
						: 'bg-emerald-600/20'
				: (row + col) % 2 === 0
					? 'bg-zinc-400/10'
					: 'bg-zinc-500/[0.13]'
			cells.push(
				<div
					key={`${col}-${row}`}
					className={cn('absolute transition-colors', fill, hl && 'hover:bg-amber-200/50')}
					style={{
						left: hexX(col, row),
						top: hexY(row),
						width: HEX_W,
						height: HEX_H,
						clipPath: HEX_CLIP,
					}}
					{...(own ? { 'data-hex-col': col, 'data-hex-row': row - 4 } : {})}
				/>,
			)
		}
	}

	return (
		<div ref={boxRef} className="relative h-full w-full select-none" style={{ perspective: 1100 }}>
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
					transformStyle: 'preserve-3d',
				}}
			>
				<div
					className="absolute inset-0"
					style={{
						transform: `rotateX(${TILT_DEG}deg)`,
						transformStyle: 'preserve-3d',
						// 棋盘绕中心前倾，视觉上把棋盘下移一点补偿投影偏移
						transformOrigin: '50% 55%',
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
									left: hexX(m.pos.col, 3 - m.pos.row),
									top: hexY(3 - m.pos.row),
									transform: STAND,
									transformOrigin: '50% 100%',
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
									className="absolute cursor-grab touch-none"
									style={{
										left: hexX(u.pos.col, row),
										top: hexY(row),
										transform: STAND,
										transformOrigin: '50% 100%',
										transition: 'left 120ms linear, top 120ms linear',
									}}
									onPointerDown={(e) => onUnitPointerDown(e, u.uid)}
								>
									<UnitToken
										apiName={u.apiName}
										star={u.star}
										items={u.items}
										marked={u.alphaMark}
										chosenTrait={u.chosenTrait}
									/>
									{dragKind === 'item' && (
										<div
											className="pointer-events-none absolute inset-0 bg-amber-300/30"
											style={{ clipPath: HEX_CLIP }}
										/>
									)}
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
							)
						})}
					{combat &&
						playbackUnits.map((u) => {
							const row = toDisplayRow(u.pos.row)
							const lunge = combatLunge(u, playbackT, toDisplayRow)
							const name =
								CHAMPION_BY_API.get(u.apiName)?.name ??
								MONSTER_BY_API.get(u.apiName)?.name ??
								u.apiName
							return (
								<div
									key={u.uid}
									className="group absolute cursor-pointer"
									style={{
										left: hexX(u.pos.col, row),
										top: hexY(row),
										transition:
											'left 120ms linear, top 120ms linear, opacity 400ms ease-in, scale 400ms ease-in',
										opacity: u.alive ? 1 : 0,
										scale: u.alive ? '1' : '0.4',
										transform: lunge ? `${STAND} translate(${lunge.dx}px, ${lunge.dy}px)` : STAND,
										transformOrigin: '50% 100%',
									}}
									onClick={() => onCombatUnitClick?.(u.uid)}
								>
									<UnitToken
										apiName={u.apiName}
										star={u.star}
										hideStar={u.isSummon}
										hp={u.hp}
										maxHp={u.maxHp}
										mana={u.maxMana > 0 ? u.mana : undefined}
										maxMana={u.maxMana > 0 ? u.maxMana : undefined}
										castFlash={u.castAt >= 0 && playbackT - u.castAt < 0.35}
										attackFlash={u.attackAt >= 0 && playbackT - u.attackAt < 0.15}
									/>
									{/* hover 小卡：名字 + 血蓝 */}
									<div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded border border-zinc-600 bg-zinc-900/95 px-2 py-1 text-[11px] leading-tight text-zinc-200 group-hover:block">
										<div className="font-bold">
											{name}
											{!u.isSummon && (
												<span className="ml-1 text-amber-300">{'★'.repeat(u.star)}</span>
											)}
										</div>
										<div className="font-mono text-green-300">
											{Math.max(0, Math.round(u.hp))} / {Math.round(u.maxHp)}
											{u.maxMana > 0 && (
												<span className="ml-1.5 text-cyan-300">
													{Math.round(u.mana)} / {Math.round(u.maxMana)}
												</span>
											)}
										</div>
									</div>
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
					{/* 技能特效：弹道飞向目标 + 落点范围闪光 */}
					{casts.map((fx) => {
						const p = Math.min(1, Math.max(0, (playbackT - fx.t) / 0.6))
						const fr = toDisplayRow(fx.from.row)
						const tr = toDisplayRow(fx.to.row)
						const x1 = hexX(fx.from.col, fr) + HEX_W / 2
						const y1 = hexY(fr) + HEX_H / 2
						const x2 = hexX(fx.to.col, tr) + HEX_W / 2
						const y2 = hexY(tr) + HEX_H / 2
						const rgb =
							fx.spell === 'heal'
								? '74,222,128'
								: fx.spell === 'shield'
									? '56,189,248'
									: fx.spell === 'buff'
										? '251,191,36'
										: '167,139,250'
						const selfCast = fx.from.col === fx.to.col && fx.from.row === fx.to.row
						const flyP = Math.min(1, p / 0.45)
						const ringP = selfCast ? p : Math.max(0, (p - 0.45) / 0.55)
						const ringBase = fx.aoe >= 99 ? 3 : fx.aoe >= 1 ? 1.9 : 1
						const aoeHexes =
							fx.aoe >= 1 && fx.aoe < 99 ? hexesInRange(fx.to, Math.min(fx.aoe, 2)) : []
						return (
							<div key={fx.key}>
								{!selfCast && p < 0.45 && (
									<div
										className="pointer-events-none absolute h-3.5 w-3.5 rounded-full"
										style={{
											left: x1 + (x2 - x1) * flyP - 7,
											top: y1 + (y2 - y1) * flyP - 7,
											background: `radial-gradient(circle, #fff 0%, rgba(${rgb},1) 45%, transparent 100%)`,
											boxShadow: `0 0 10px 4px rgba(${rgb},0.8)`,
										}}
									/>
								)}
								{ringP > 0 && (
									<>
										<div
											className="pointer-events-none absolute rounded-full border-2"
											style={{
												left: x2 - (HEX_W * ringBase * (0.5 + ringP)) / 2,
												top: y2 - (HEX_W * ringBase * (0.5 + ringP)) / 2,
												width: HEX_W * ringBase * (0.5 + ringP),
												height: HEX_W * ringBase * (0.5 + ringP),
												borderColor: `rgba(${rgb},${0.9 * (1 - ringP)})`,
												boxShadow: `0 0 14px 2px rgba(${rgb},${0.5 * (1 - ringP)})`,
											}}
										/>
										{aoeHexes.map((h) => (
											<div
												key={`${h.col},${h.row}`}
												className="pointer-events-none absolute"
												style={{
													left: hexX(h.col, toDisplayRow(h.row)),
													top: hexY(toDisplayRow(h.row)),
													width: HEX_W,
													height: HEX_H,
													clipPath: HEX_CLIP,
													background: `rgba(${rgb},${0.35 * (1 - ringP)})`,
												}}
											/>
										))}
									</>
								)}
							</div>
						)
					})}
					{floats.map((f) => {
						const row = toDisplayRow(f.pos.row)
						return (
							<div
								key={f.key}
								className="pointer-events-none absolute"
								style={{
									left: hexX(f.pos.col, row) + HEX_W / 2 - 10 + (((f.key * 37) % 5) - 2) * 14,
									top: hexY(row) + Math.round(HEX_H * 0.3) - ((f.key * 23) % 3) * 14,
									transform: STAND,
									transformOrigin: '50% 100%',
								}}
							>
								<div
									className={cn(
										'font-bold',
										f.kind === 'heal'
											? 'text-green-400'
											: f.kind === 'shield'
												? 'text-sky-300'
												: f.crit
													? 'text-orange-400 text-lg'
													: 'text-red-300',
									)}
									style={{
										textShadow: '0 0 4px #000',
										animation: 'tft-float 0.8s ease-out forwards',
									}}
								>
									{f.kind === 'damage' ? '-' : '+'}
									{f.value}
								</div>
							</div>
						)
					})}
				</div>
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
