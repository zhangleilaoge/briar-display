'use client'
import { cn } from '@/lib/utils'
import { CHAMPION_BY_API, ITEM_BY_API } from '../data/set18'
import { MONSTER_BY_API } from '../data/set18/monsters'
import { isLux, luxFormOf } from '../engine/lux'
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
	/** 召唤物等不显示星级 */
	hideStar?: boolean
	/** 阿尔法印记增益角标 */
	marked?: boolean
	/** 拉克丝选定羁绊（切换形态图标） */
	chosenTrait?: string
	/** 六边形宽；高按点顶六边形比例推导。默认占满棋盘格 */
	size?: number
}

/** 棋子令牌：六边形头像占满格子 + 星级 + 血蓝条（叠加在六边形内）+ 装备角标 */
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
	hideStar,
	marked,
	chosenTrait,
	size = HEX_W,
}: UnitTokenProps) {
	const champ = CHAMPION_BY_API.get(apiName)
	// PvE 野怪（不在棋子表里）查野怪表取图标/名字
	const monster = champ ? undefined : MONSTER_BY_API.get(apiName)
	const isPve = !champ
	const name = champ?.name ?? monster?.name ?? apiName
	const luxIcon = chosenTrait && isLux(apiName) ? luxFormOf(chosenTrait)?.icon : undefined
	const icon = luxIcon ?? champ?.icon ?? monster?.icon
	const showBars = hp !== undefined && maxHp !== undefined && maxHp > 0
	const hpPct = showBars ? Math.max(0, Math.min(1, (hp ?? 0) / maxHp)) : 0
	const manaPct = maxMana ? Math.max(0, Math.min(1, (mana ?? 0) / maxMana)) : 0
	const w = size
	const h = Math.round(size / 0.866)
	return (
		<div
			className={cn('relative', dimmed && 'opacity-50')}
			style={{ width: w, height: h }}
			title={name}
		>
			<div
				className={cn(
					'relative h-full w-full border-2 bg-zinc-800 transition-transform',
					isPve ? 'border-zinc-500' : COST_BORDER[champ?.cost ?? 1],
					attackFlash && 'scale-110',
					castFlash && 'ring-2 ring-cyan-300',
				)}
				style={{
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
			{/* 星级（野怪/召唤物不显示）：叠在六边形顶角下方 */}
			{!isPve && !hideStar && (
				<div
					className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-amber-300"
					style={{
						top: Math.round(h * 0.08),
						fontSize: Math.max(9, size / 6),
						textShadow: '0 0 3px #000, 0 0 3px #000',
					}}
				>
					{'★'.repeat(star)}
				</div>
			)}
			{/* 阿尔法印记角标：六边形右上角 */}
			{marked && (
				<img
					src="/briar/tft/icons/traits/DA_Riftbeast18.png"
					alt="阿尔法印记"
					title="阿尔法印记：独特增益生效中"
					className="pointer-events-none absolute rounded-full border border-violet-400 bg-zinc-900/90"
					style={{
						right: Math.round(w * 0.08),
						top: Math.round(h * 0.1),
						width: Math.max(12, Math.round(size / 4.5)),
						height: Math.max(12, Math.round(size / 4.5)),
					}}
					draggable={false}
				/>
			)}
			{/* 装备角标：六边形底角上方一排 */}
			{items.length > 0 && (
				<div
					className="pointer-events-none absolute left-1/2 flex -translate-x-1/2 gap-0.5"
					style={{ bottom: Math.round(h * 0.13) }}
				>
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
			{/* 血蓝条：叠加在六边形内下沿 */}
			{showBars && (
				<div
					className="pointer-events-none absolute left-1/2 w-3/5 -translate-x-1/2"
					style={{ bottom: Math.round(h * 0.2) }}
				>
					<div className="h-1 w-full overflow-hidden rounded-sm bg-zinc-900/80">
						<div
							className={cn('h-full', hpPct > 0.3 ? 'bg-green-500' : 'bg-red-500')}
							style={{ width: `${hpPct * 100}%` }}
						/>
					</div>
					{maxMana ? (
						<div className="mt-px h-0.5 w-full overflow-hidden rounded-sm bg-zinc-900/80">
							<div className="h-full bg-cyan-400" style={{ width: `${manaPct * 100}%` }} />
						</div>
					) : null}
				</div>
			)}
		</div>
	)
}

export { HEX_H, HEX_W }
