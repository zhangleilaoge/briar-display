'use client'
import { cn } from '@/lib/utils'
import { CHAMPION_BY_API, ITEM_BY_API } from '../data/set18'
import { MONSTER_BY_API } from '../data/set18/monsters'
import type { StarLevel } from '../engine/types'
import { COST_BORDER, HEX_CLIP, HEX_H, HEX_W } from './layout'

interface UnitTokenProps {
	apiName: string
	star: StarLevel | number
	items?: string[]
	hp?: number
	maxHp?: number
	mana?: number
	maxMana?: number
	/** 战斗闪光时间戳 */
	castFlash?: boolean
	attackFlash?: boolean
	dimmed?: boolean
	size?: number
}

/** 棋子令牌：头像 + 星级 + 血蓝条 + 装备角标 */
export function UnitToken({
	apiName,
	star,
	items = [],
	hp,
	maxHp,
	mana,
	maxMana,
	castFlash,
	attackFlash,
	dimmed,
	size = HEX_W - 14,
}: UnitTokenProps) {
	const champ = CHAMPION_BY_API.get(apiName)
	// PvE 野怪（不在棋子表里）查野怪表取图标/名字
	const monster = champ ? undefined : MONSTER_BY_API.get(apiName)
	const isPve = !champ
	const name = champ?.name ?? monster?.name ?? apiName
	const icon = champ?.icon ?? monster?.icon
	const showBars = hp !== undefined && maxHp !== undefined && maxHp > 0
	const hpPct = showBars ? Math.max(0, Math.min(1, (hp ?? 0) / maxHp)) : 0
	const manaPct = maxMana ? Math.max(0, Math.min(1, (mana ?? 0) / maxMana)) : 0
	return (
		<div
			className={cn('relative flex flex-col items-center', dimmed && 'opacity-50')}
			style={{ width: size, height: size + (showBars ? 10 : 0) }}
			title={name}
		>
			<div
				className={cn(
					'relative border-2 bg-zinc-800 transition-transform',
					isPve ? 'border-zinc-500' : COST_BORDER[champ?.cost ?? 1],
					attackFlash && 'scale-110',
					castFlash && 'ring-2 ring-cyan-300',
				)}
				style={{
					width: size,
					height: size,
					clipPath: HEX_CLIP,
					transitionDuration: '120ms',
				}}
			>
				{icon ? (
					<img src={icon} alt={name} className="h-full w-full object-cover" draggable={false} />
				) : (
					<div className="flex h-full w-full items-center justify-center text-[10px] text-zinc-300">
						{name.slice(0, 2)}
					</div>
				)}
			</div>
			{/* 星级（野怪不显示） */}
			{!isPve && (
				<div
					className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap text-amber-300"
					style={{ fontSize: Math.max(9, size / 6), textShadow: '0 0 3px #000' }}
				>
					{'★'.repeat(star)}
				</div>
			)}
			{/* 装备角标 */}
			{items.length > 0 && (
				<div className="pointer-events-none absolute -bottom-1 left-1/2 flex -translate-x-1/2 gap-0.5">
					{items.slice(0, 3).map((itemApi) => {
						const item = ITEM_BY_API.get(itemApi)
						return (
							<img
								key={itemApi}
								src={item?.icon}
								alt={item?.name ?? itemApi}
								title={item?.name}
								className="h-3.5 w-3.5 rounded-sm border border-zinc-600 bg-zinc-900"
								draggable={false}
							/>
						)
					})}
				</div>
			)}
			{/* 血蓝条 */}
			{showBars && (
				<div className="mt-0.5 w-full">
					<div className="h-1 w-full overflow-hidden rounded bg-zinc-700">
						<div
							className={cn('h-full', hpPct > 0.3 ? 'bg-green-500' : 'bg-red-500')}
							style={{ width: `${hpPct * 100}%` }}
						/>
					</div>
					{maxMana ? (
						<div className="mt-px h-0.5 w-full overflow-hidden rounded bg-zinc-700">
							<div className="h-full bg-cyan-400" style={{ width: `${manaPct * 100}%` }} />
						</div>
					) : null}
				</div>
			)}
		</div>
	)
}

export const UNIT_TOKEN_H = HEX_W - 14 + 10
export const UNIT_TOKEN_W = HEX_W - 14
export { HEX_H, HEX_W }
