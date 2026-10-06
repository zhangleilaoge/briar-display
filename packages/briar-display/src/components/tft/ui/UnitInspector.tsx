'use client'
import { cn } from '@/lib/utils'
import { Coins, X } from 'lucide-react'
import { toast } from 'sonner'
import { sellPriceOf } from '../data/rules'
import { CHAMPION_BY_API, TRAIT_BY_API } from '../data/set18'
import { anyItemByApi } from '../data/set18/consumables'
import { formatTftDesc } from '../data/set18/descFormat'
import { MONSTER_BY_API } from '../data/set18/monsters'
import { applyPlayerBuffs } from '../engine/playerBuffs'
import { tftStore } from '../engine/store'
import { applyTraitStats } from '../engine/traitEffects'
import { computeActiveTraits } from '../engine/traits'
import type { CombatStats, PlayerState, UnitInstance } from '../engine/types'
import { unitStats } from '../engine/units'
import { ItemTooltip } from './ItemTray'
import { COST_BORDER, COST_TEXT } from './layout'

interface UnitInspectorProps {
	unit: UnitInstance
	/** 棋子所属玩家（结算羁绊/海克斯增益） */
	owner: PlayerState
	/** 仅自己的棋子且备战阶段可出售 */
	sellable: boolean
	/** 战斗回放查看：直接给开战时的结算面板（不再按 owner 重算） */
	presetStats?: CombatStats
	onClose: () => void
}

/** 棋子属性面板：点击棋子弹出，右侧停靠大卡（对齐实机选中棋子面板：原画/血蓝条/装备格/属性/出售） */
export function UnitInspector({ unit, owner, sellable, presetStats, onClose }: UnitInspectorProps) {
	const champ = CHAMPION_BY_API.get(unit.apiName)
	const monster = champ ? undefined : MONSTER_BY_API.get(unit.apiName)
	if (!champ && !monster) return null
	// 场上棋子显示结算羁绊/海克斯后的面板；备战席棋子显示基础+装备面板；presetStats 直接用开战快照
	const onBoard = owner.board.some((b) => b.uid === unit.uid)
	const st = presetStats
		? presetStats
		: champ && onBoard
			? applyPlayerBuffs(
					owner,
					applyTraitStats(unit, unitStats(unit), computeActiveTraits(owner.board)),
					unit,
				)
			: champ
				? unitStats(unit)
				: {
						maxHp: monster?.stats.maxHp ?? 1,
						attackDamage: monster?.stats.attackDamage ?? 0,
						abilityPower: 100,
						attackSpeed: monster?.stats.attackSpeed ?? 0.6,
						armor: monster?.stats.armor ?? 0,
						magicResist: monster?.stats.magicResist ?? 0,
						mana: 0,
						initialMana: 0,
						range: monster?.stats.range ?? 1,
						critChance: 0,
						critMultiplier: 1.4,
						manaRegen: 0,
						damageAmp: 0,
						damageReduction: 0,
						omnivamp: 0,
					}
	const name = champ?.name ?? monster?.name ?? unit.apiName
	const icon = champ?.icon ?? monster?.icon
	const price = champ ? sellPriceOf(champ.cost, unit.star) : 0
	const canSell = sellable && tftStore.engine?.state.phase === 'planning'
	const stats: [string, string][] = [
		['物理攻击', String(Math.round(st.attackDamage))],
		['法术强度', String(Math.round(st.abilityPower))],
		['护甲', String(Math.round(st.armor))],
		['魔法抗性', String(Math.round(st.magicResist))],
		['攻击速度', st.attackSpeed.toFixed(2)],
		['暴击几率', `${Math.round(st.critChance * 100)}%`],
		['暴击伤害', `${Math.round(st.critMultiplier * 100)}%`],
		['攻击距离', String(st.range)],
	]
	const manaPct = st.mana > 0 ? Math.min(1, st.initialMana / st.mana) : 0
	return (
		<div
			className="fixed inset-0 z-50"
			onClick={onClose}
			onKeyDown={(e) => e.key === 'Escape' && onClose()}
			role="presentation"
		>
			<div
				className="absolute right-44 top-1/2 flex w-72 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-cyan-900/60 bg-slate-950/95 shadow-[0_0_40px_rgba(34,211,238,0.15)]"
				onClick={(e) => e.stopPropagation()}
				onKeyDown={() => {}}
				role="presentation"
			>
				<button
					type="button"
					onClick={onClose}
					className="absolute right-2 top-2 z-10 rounded bg-black/50 p-1 text-zinc-400 hover:text-zinc-100"
				>
					<X className="h-4 w-4" />
				</button>
				{/* 原画大卡：左侧羁绊列 + 顶部星级 */}
				<div
					className={cn('relative border-b-2', champ ? COST_BORDER[champ.cost] : 'border-zinc-500')}
				>
					<img
						src={icon}
						alt={name}
						className="aspect-square w-full object-cover"
						draggable={false}
					/>
					<div className="absolute left-1.5 top-1.5 flex flex-col gap-1">
						{champ?.traits.map((t) => {
							const trait = TRAIT_BY_API.get(t)
							return (
								<span
									key={t}
									title={trait?.desc}
									className="flex items-center gap-1 rounded bg-black/65 px-1.5 py-0.5 text-[11px] text-zinc-200"
								>
									{trait?.icon && <img src={trait.icon} alt="" className="h-3.5 w-3.5" />}
									{trait?.name ?? t}
								</span>
							)
						})}
					</div>
					<div
						className="absolute right-2 top-1.5 text-sm text-amber-300"
						style={{ textShadow: '0 0 4px #000' }}
					>
						{'★'.repeat(unit.star)}
					</div>
					<div className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/95 to-transparent px-2.5 pb-1.5 pt-6">
						<span className="text-base font-black text-zinc-100">{name}</span>
						{champ && (
							<span
								className={cn(
									'flex items-center gap-0.5 text-sm font-black',
									COST_TEXT[champ.cost],
								)}
							>
								<Coins className="h-3.5 w-3.5 text-amber-300" />
								{champ.cost}
							</span>
						)}
					</div>
				</div>
				<div className="flex flex-col gap-2.5 p-3">
					{/* 血条 / 蓝条 */}
					<div className="space-y-1">
						<div className="relative h-3.5 overflow-hidden rounded-sm bg-zinc-800">
							<div className="h-full w-full bg-green-600" />
							<span className="absolute inset-0 flex items-center justify-center font-mono text-[10px] font-bold text-white">
								{Math.round(st.maxHp)} / {Math.round(st.maxHp)}
							</span>
						</div>
						<div className="relative h-3 overflow-hidden rounded-sm bg-zinc-800">
							<div className="h-full bg-cyan-500" style={{ width: `${manaPct * 100}%` }} />
							<span className="absolute inset-0 flex items-center justify-center font-mono text-[10px] font-bold text-white">
								{st.initialMana} / {st.mana}
							</span>
						</div>
					</div>
					{/* 装备格：固定 3 格，hover 显示详情与合成路线 */}
					<div className="flex gap-1.5">
						{Array.from({ length: 3 }, (_, i) => {
							const api = unit.items[i]
							const item = api ? anyItemByApi(api) : null
							return (
								<div
									// biome-ignore lint/suspicious/noArrayIndexKey: 装备格固定 3 位
									key={i}
									className={cn(
										'flex h-9 w-9 items-center justify-center rounded border border-zinc-700 bg-zinc-900/80',
										item && 'group relative',
									)}
								>
									{item && (
										<>
											<img src={item.icon} alt={item.name} className="h-7 w-7 rounded-sm" />
											<ItemTooltip item={item} />
										</>
									)}
								</div>
							)
						})}
					</div>
					{/* 属性网格 */}
					<div className="grid grid-cols-2 gap-x-4 gap-y-1 border-t border-zinc-800 pt-2 text-xs">
						{stats.map(([k, v]) => (
							<div key={k} className="flex justify-between">
								<span className="text-zinc-500">{k}</span>
								<span className="font-mono text-zinc-200">{v}</span>
							</div>
						))}
					</div>
					{/* 峡谷野怪霸符段：阿尔法印记解锁状态 */}
					{champ?.traits.includes('DA_Riftbeast18') &&
						(() => {
							const seg = champ.ability.desc.match(/[^\n]*霸符：[^\n]*/)?.[0]
							if (!seg) return null
							return (
								<div
									className={cn(
										'flex items-start gap-1.5 rounded border px-2 py-1 text-[11px] leading-relaxed',
										unit.alphaMark
											? 'border-violet-800/60 bg-violet-950/40 text-violet-200'
											: 'border-zinc-700/60 bg-zinc-800/40 text-zinc-500',
									)}
								>
									<img
										src="/briar/tft/icons/traits/DA_Riftbeast18.png"
										alt="阿尔法印记"
										className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full"
									/>
									<span>
										{formatTftDesc(seg, champ.ability.vars, unit.star)}
										{!unit.alphaMark && '（未解锁：对峡谷野怪使用【阿尔法印记】后生效）'}
									</span>
								</div>
							)
						})()}
					{/* 技能 */}
					{champ && (
						<div className="border-t border-zinc-800 pt-2">
							<div className="text-xs font-bold text-cyan-300">
								{champ.ability.name}
								<span className="ml-1.5 font-mono text-[10px] text-zinc-500">
									{st.initialMana}/{st.mana} 蓝
								</span>
							</div>
							<div className="mt-1 whitespace-pre-line text-[11px] leading-relaxed text-zinc-400">
								{formatTftDesc(champ.ability.desc, champ.ability.vars, unit.star)}
							</div>
						</div>
					)}
					{/* 出售 */}
					{sellable && champ && (
						<button
							type="button"
							disabled={!canSell}
							onClick={() => {
								if (tftStore.engine?.sellUnit(0, unit.uid)) toast.success(`已出售 +${price} 金`)
								onClose()
							}}
							className={cn(
								'mt-1 flex h-8 items-center justify-center gap-1 rounded-md border text-sm font-bold',
								canSell
									? 'border-red-800/70 bg-red-950/50 text-red-200 hover:bg-red-900/60'
									: 'cursor-not-allowed border-zinc-800 bg-zinc-900/50 text-zinc-600',
							)}
							title={canSell ? undefined : '仅备战阶段可出售'}
						>
							出售 +{price} 金
						</button>
					)}
				</div>
			</div>
		</div>
	)
}
