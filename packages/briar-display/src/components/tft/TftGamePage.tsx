'use client'
import { Button } from '@/components/ui/button'
import { Eye, Hexagon, Swords } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { toast } from 'sonner'
import { CHAMPION_BY_API } from './data/set18'
import { AUGMENT_BY_API } from './data/set18/augments'
import { anyItemByApi } from './data/set18/consumables'
import { type DragPayload, type DragState, type DropTarget, resolveDropTarget } from './dnd'
import { tftDebug, tftStore, useTftVersion } from './engine/store'
import type { CombatStats, UnitInstance } from './engine/types'
import { boardUsed, teamCap } from './engine/units'
import { ArmoryModal } from './ui/ArmoryModal'
import { AugmentBar } from './ui/AugmentBar'
import { AugmentModal } from './ui/AugmentModal'
import { Bench } from './ui/Bench'
import { Board } from './ui/Board'
import { Carousel } from './ui/Carousel'
import { EconPanel } from './ui/EconPanel'
import { EndScreen } from './ui/EndScreen'
import { Hud } from './ui/Hud'
import { ItemTray } from './ui/ItemTray'
import { PlayerList } from './ui/PlayerList'
import { Shop } from './ui/Shop'
import { TraitPanel } from './ui/TraitPanel'
import { UnitInspector } from './ui/UnitInspector'

export default function TftGamePage() {
	useTftVersion()
	const engine = tftStore.engine
	const [drag, setDrag] = useState<DragState | null>(null)
	const dragPayloadRef = useRef<DragPayload | null>(null)
	const pressRef = useRef<{ payload: DragPayload; x: number; y: number } | null>(null)
	const [inspectUid, setInspectUid] = useState<string | null>(null)
	/** 战斗中点击的非己方棋子快照（对方棋子/野怪，用开战输入面板展示） */
	const [combatInspect, setCombatInspect] = useState<{
		unit: UnitInstance
		stats: CombatStats
	} | null>(null)
	/** 正在查看棋盘的玩家 id（0=自己；点击右侧玩家列表切换） */
	const [viewId, setViewId] = useState(0)

	const startDrag = (e: ReactPointerEvent, payload: DragPayload) => {
		pressRef.current = { payload, x: e.clientX, y: e.clientY }
		if (!engine || engine.state.phase !== 'planning' || viewId !== 0) return
		e.preventDefault()
		dragPayloadRef.current = payload
		setDrag({ payload, x: e.clientX, y: e.clientY })
	}

	const handleDrop = (payload: DragPayload, target: DropTarget) => {
		const eng = tftStore.engine
		if (!eng || eng.state.phase !== 'planning') return
		const me = eng.state.players[0]
		if (payload.kind === 'unit') {
			if (target.kind === 'hex') {
				if (!eng.placeUnit(0, payload.uid, target.col, target.row)) {
					toast.error('无法放置：上场数量已达等级上限')
				}
			} else if (target.kind === 'bench') {
				eng.benchUnit(0, payload.uid, target.index)
			} else if (target.kind === 'sell') {
				if (eng.sellUnit(0, payload.uid)) toast.success('已出售')
			}
			return
		}
		// 装备 → 落在棋子上（棋盘或备战席）
		const uid =
			target.kind === 'hex'
				? (me.board.find((b) => b.pos.col === target.col && b.pos.row === target.row)?.uid ?? null)
				: target.kind === 'bench'
					? (me.bench[target.index]?.uid ?? null)
					: null
		if (!uid) return
		if (!eng.equipItem(0, uid, payload.itemApi)) {
			toast.error('装备失败：该棋子装备已满')
		}
	}

	// 战斗阶段点击棋子：己方棋子走常规面板；对方/野怪用开战输入快照
	const openCombatInspect = (uid: string) => {
		const eng = tftStore.engine
		if (!eng) return
		const st = eng.state
		const vw = st.players[viewId]?.alive ? st.players[viewId] : st.players[0]
		const own = [...vw.board, ...vw.bench].find((x) => x?.uid === uid)
		if (own) {
			setInspectUid(uid)
			return
		}
		const rec = st.combats.get(viewId) ?? st.combats.get(0)
		const inp = rec?.inputsA.find((i) => i.uid === uid) ?? rec?.inputsB.find((i) => i.uid === uid)
		if (inp) {
			setCombatInspect({
				unit: {
					uid,
					apiName: inp.apiName,
					star: inp.star,
					items: inp.items,
					alphaMark: inp.alphaMark,
				},
				stats: inp.stats,
			})
		}
	}

	useEffect(() => {
		const move = (e: PointerEvent) => setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY } : d))
		const up = (e: PointerEvent) => {
			const press = pressRef.current
			pressRef.current = null
			// 位移小于阈值视为点击：棋子打开属性面板
			const isClick = press && Math.hypot(e.clientX - press.x, e.clientY - press.y) < 8
			if (isClick && press.payload.kind === 'unit') {
				setInspectUid(press.payload.uid)
			} else if (press && !isClick && tftStore.engine?.state.phase === 'planning' && viewId !== 0) {
				toast.info('查看他人棋盘时不可操作，点击右侧「你」返回')
			} else if (press && !isClick && tftStore.engine?.state.phase !== 'planning') {
				toast.info('仅备战阶段可以调整棋子/装备')
			}
			const payload = dragPayloadRef.current
			if (payload && !isClick) handleDrop(payload, resolveDropTarget(e.clientX, e.clientY))
			dragPayloadRef.current = null
			setDrag(null)
		}
		window.addEventListener('pointermove', move)
		window.addEventListener('pointerup', up)
		return () => {
			window.removeEventListener('pointermove', move)
			window.removeEventListener('pointerup', up)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [viewId])

	useEffect(() => {
		if (!engine || !tftDebug.enabled || !tftDebug.to) return
		const m = tftDebug.to.match(/^(\d+)-(\d+)$/)
		if (m) engine.jumpTo(Number(m[1]), Number(m[2]))
	}, [engine])

	// 查看对象被淘汰后自动返回自己棋盘
	const viewedAlive = engine?.state.players[viewId]?.alive ?? false
	useEffect(() => {
		if (viewId !== 0 && !viewedAlive) setViewId(0)
	}, [viewId, viewedAlive])

	if (!engine) return <Lobby />

	const s = engine.state
	const me = s.players[0]
	const viewed = s.players[viewId]?.alive ? s.players[viewId] : me
	const record = s.combats.get(0) ?? null
	// 棋盘区域展示被查看者的战斗现场（回放/对手均以被查看者视角）
	const boardRecord = s.combats.get(viewId) ?? record
	const playbackT = Math.max(0, (s.gameTime - s.combatStartAt) / 1000)
	const remainMs = s.phase === 'carousel' ? 0 : s.phaseEndsAt - s.gameTime
	const myOffers = s.augmentOffers.get(0)
	// 开局 0 金币时商店隐藏（官方：1-1 无商店，有钱后才出现）
	const shopHidden = s.stage === 1 && me.gold === 0
	// 拖拽中的棋子信息（同名同星高亮提示合成）
	const dragUnit =
		drag?.payload.kind === 'unit'
			? ([...me.board, ...me.bench].find((x) => x?.uid === (drag.payload as { uid: string }).uid) ??
				null)
			: null

	return (
		<div
			className="relative flex h-screen select-none flex-col overflow-hidden text-zinc-100"
			style={{
				background:
					'radial-gradient(ellipse 90% 70% at 50% 30%, #1a2433 0%, #10161f 45%, #090d13 100%)',
			}}
		>
			{' '}
			{/* 顶部 HUD */}
			<div className="px-3 pt-1.5">
				<Hud
					phase={s.phase}
					stage={s.stage}
					round={s.round}
					remainMs={remainMs}
					speed={tftStore.speed}
					record={record}
					onSpeed={(v) => tftStore.setSpeed(v)}
					onQuit={() => tftStore.quit()}
					debug={tftDebug.enabled}
					onSkip={() => engine.skipPhase()}
				/>
			</div>
			{/* 中部：海克斯+羁绊 | 棋盘+备战席 | 对手 */}
			<div className="flex min-h-0 flex-1 gap-2 px-2 py-1">
				<div className="flex w-44 shrink-0 flex-col">
					<AugmentBar player={viewed} />
					<TraitPanel
						me={viewed}
						canRedeemCoven={viewId === 0 && s.phase === 'planning'}
						onRedeemCoven={() => engine.redeemCoven(0)}
					/>
				</div>
				<div className="flex min-w-0 flex-1 flex-col">
					<div className="relative min-h-0 flex-1">
						<Board
							phase={s.phase}
							me={viewed}
							record={s.phase === 'combat' ? boardRecord : null}
							playbackT={playbackT}
							pveWave={s.phase === 'planning' ? s.pveWave : null}
							dragKind={drag?.payload.kind ?? null}
							dragUnit={dragUnit}
							onUnitPointerDown={(e, uid) => startDrag(e, { kind: 'unit', uid })}
							onCombatUnitClick={openCombatInspect}
						/>
						{/* 备战阶段中央提示：阶段名 + 人口（对齐实机 Planning 3/4） */}
						{s.phase === 'planning' && !myOffers && (
							<div className="pointer-events-none absolute inset-x-0 top-2 flex flex-col items-center">
								<span
									className="text-2xl font-black tracking-widest text-cyan-100/80"
									style={{ textShadow: '0 0 16px rgba(103,232,249,0.55)' }}
								>
									备战阶段
								</span>
								<span className="mt-0.5 flex items-center gap-1 text-base font-bold text-cyan-200/70">
									<Hexagon className="h-4 w-4" />
									{boardUsed(viewed)} / {teamCap(viewed)}
								</span>
							</div>
						)}
						{/* 查看他人棋盘提示条 */}
						{viewId !== 0 && (
							<button
								type="button"
								onClick={() => setViewId(0)}
								className="absolute left-1/2 top-2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-sky-500/50 bg-sky-950/70 px-3 py-1 text-xs font-bold text-sky-200 backdrop-blur-sm hover:bg-sky-900/70"
							>
								<Eye className="h-3.5 w-3.5" />
								正在查看 {viewed.name} 的棋盘 · 点击返回
							</button>
						)}
					</div>
					<div className="flex justify-center py-1">
						<Bench
							me={viewed}
							dragUnit={dragUnit}
							onUnitPointerDown={(e, uid) => startDrag(e, { kind: 'unit', uid })}
						/>
					</div>
				</div>
				<PlayerList
					players={s.players}
					opponentId={s.phase === 'combat' ? boardRecord?.opponentId : null}
					viewedId={viewId}
					onView={(id) => setViewId(id)}
				/>
			</div>
			{/* 底部：经济簇 | 商店（拖棋子时变出售条） | 装备栏 */}
			<div className="flex items-end justify-between gap-3 px-3 pb-2">
				<EconPanel
					me={me}
					onRefresh={() => engine.refreshShop(0)}
					onBuyXp={() => engine.buyXp(0)}
					onToggleLock={() => engine.toggleShopLock(0)}
				/>
				<div className="flex flex-1 justify-center">
					{shopHidden ? (
						// 占位保持布局：开局 0 金币时商店尚未开启
						<div className="flex h-full w-full items-center justify-center text-xs text-zinc-600">
							商店将在获得金币后开启
						</div>
					) : (
						<Shop
							me={me}
							sellUnit={dragUnit}
							onBuy={(slot) => {
								if (!engine.buyShopSlot(0, slot)) toast.error('无法购买：金币不足或备战席已满')
							}}
						/>
					)}
				</div>
				<ItemTray
					items={me.itemTray}
					onItemPointerDown={(e, itemApi) => startDrag(e, { kind: 'item', itemApi })}
				/>
			</div>
			{s.phase === 'carousel' && (
				<Carousel
					state={s}
					onPick={(i) => {
						if (!engine.pickCarousel(0, i)) toast.info('还没轮到你')
					}}
				/>
			)}
			{s.phase === 'encounter' &&
				(() => {
					const enc = AUGMENT_BY_API.get(s.encounterApi ?? '')
					return enc ? (
						<div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-zinc-950/70">
							<div className="flex items-center gap-2 text-sm font-bold text-fuchsia-300">
								<Hexagon className="h-4 w-4" />
								开局遭遇
							</div>
							<div
								className="mt-3 text-4xl font-black tracking-wide text-zinc-100"
								style={{ textShadow: '0 0 24px rgba(232,121,249,0.6)' }}
							>
								{enc.name}
							</div>
							<div className="mt-2 max-w-md text-center text-sm text-zinc-400">{enc.desc}</div>
						</div>
					) : null
				})()}
			{s.phase === 'planning' && myOffers && (
				<AugmentModal offers={myOffers} onPick={(api) => engine.pickAugment(0, api)} />
			)}
			{s.phase === 'planning' && !myOffers && me.armory && (
				<ArmoryModal armory={me.armory} onPick={(api) => engine.pickArmory(0, api)} />
			)}
			{s.phase === 'ended' && (
				<EndScreen
					players={s.players}
					onRestart={() => tftStore.start()}
					onLobby={() => tftStore.quit()}
				/>
			)}
			{/* 棋子属性面板（点击查看；他人棋子只读） */}
			{inspectUid &&
				(() => {
					const u = [...viewed.board, ...viewed.bench].find((x) => x?.uid === inspectUid)
					return u ? (
						<UnitInspector
							unit={u}
							owner={viewed}
							sellable={viewId === 0}
							onClose={() => setInspectUid(null)}
						/>
					) : null
				})()}
			{/* 战斗中点击对方/野怪棋子的只读快照面板 */}
			{combatInspect && (
				<UnitInspector
					unit={combatInspect.unit}
					owner={viewed}
					sellable={false}
					presetStats={combatInspect.stats}
					onClose={() => setCombatInspect(null)}
				/>
			)}
			{/* 拖拽跟随层 */}
			{drag && (
				<div
					className="pointer-events-none fixed z-50"
					style={{ left: drag.x - 26, top: drag.y - 26 }}
				>
					{drag.payload.kind === 'unit'
						? (() => {
								const all = [...me.board, ...me.bench]
								const u = all.find((x) => x?.uid === (drag.payload as { uid: string }).uid)
								return u ? (
									<img
										src={CHAMPION_BY_API.get(u.apiName)?.icon}
										alt=""
										className="h-13 w-13 rounded-full opacity-90"
										style={{ width: 52, height: 52 }}
									/>
								) : null
							})()
						: (() => {
								const api = (drag.payload as { itemApi: string }).itemApi
								const item = anyItemByApi(api)
								return item ? (
									<img src={item.icon} alt={item.name} className="h-8 w-8 rounded opacity-90" />
								) : null
							})()}
				</div>
			)}
		</div>
	)
}

function Lobby() {
	return (
		<div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 text-zinc-100">
			<div className="w-[34rem] rounded-xl border border-zinc-700 bg-zinc-900 p-8 text-center">
				<h1 className="text-2xl font-black">云顶之弈 · S18 自然之力</h1>
				<p className="mt-1 text-sm text-zinc-400">Web 复刻版 · 单机对战 7 名 AI</p>
				<ul className="mt-4 space-y-1 text-left text-xs leading-relaxed text-zinc-400">
					<li>· 棋子 / 羁绊 / 装备 / 卡池 / 经济 / 回合结构取自 S18 官方数据（CommunityDragon）</li>
					<li>· 技能按官方描述归类引擎近似还原；视觉为 3D 透视棋盘（棋子竖立）</li>
					<li>
						· 完整对局：1-1 遭遇 → 小兵 PvE → 海克斯强化（2-1/3-2/4-2）→ 选秀（x-4）→ Boss
						野怪（x-7）→ 淘汰结算
					</li>
				</ul>
				<Button size="lg" className="mt-6 w-full" onClick={() => tftStore.start()}>
					<Swords className="mr-2 h-4 w-4" />
					开始对局
				</Button>
			</div>
		</div>
	)
}
