'use client'
import { Button } from '@/components/ui/button'
import { Swords } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { toast } from 'sonner'
import { MAX_LEVEL } from './data/rules'
import { CHAMPION_BY_API, ITEM_BY_API } from './data/set18'
import { type DragPayload, type DragState, type DropTarget, resolveDropTarget } from './dnd'
import { tftDebug, tftStore, useTftVersion } from './engine/store'
import { AugmentModal } from './ui/AugmentModal'
import { Bench } from './ui/Bench'
import { Board } from './ui/Board'
import { Carousel } from './ui/Carousel'
import { EndScreen } from './ui/EndScreen'
import { Hud } from './ui/Hud'
import { ItemTray } from './ui/ItemTray'
import { PlayerList } from './ui/PlayerList'
import { Shop } from './ui/Shop'
import { TraitPanel } from './ui/TraitPanel'

export default function TftGamePage() {
	useTftVersion()
	const engine = tftStore.engine
	const [drag, setDrag] = useState<DragState | null>(null)
	const dragPayloadRef = useRef<DragPayload | null>(null)
	const dragOn = drag !== null

	const startDrag = (e: ReactPointerEvent, payload: DragPayload) => {
		if (!engine || engine.state.phase !== 'planning') {
			toast.info('仅备战阶段可以调整棋子/装备')
			return
		}
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

	useEffect(() => {
		if (!dragOn) return
		const move = (e: PointerEvent) => setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY } : d))
		const up = (e: PointerEvent) => {
			const payload = dragPayloadRef.current
			if (payload) handleDrop(payload, resolveDropTarget(e.clientX, e.clientY))
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
	}, [dragOn])

	useEffect(() => {
		if (!engine || !tftDebug.enabled || !tftDebug.to) return
		const m = tftDebug.to.match(/^(\d+)-(\d+)$/)
		if (m) engine.jumpTo(Number(m[1]), Number(m[2]))
	}, [engine])

	if (!engine) return <Lobby />

	const s = engine.state
	const me = s.players[0]
	const record = s.combats.get(0) ?? null
	const playbackT = Math.max(0, (s.gameTime - s.combatStartAt) / 1000)
	const remainMs = s.phase === 'carousel' ? 0 : s.phaseEndsAt - s.gameTime
	const myOffers = s.augmentOffers.get(0)

	return (
		<div className="relative flex h-screen select-none flex-col overflow-hidden bg-zinc-950 text-zinc-100">
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

			{/* 中部：羁绊 | 棋盘+备战席 | 对手 */}
			<div className="flex min-h-0 flex-1 gap-2 px-2 py-1">
				<TraitPanel me={me} />
				<div className="flex min-w-0 flex-1 flex-col">
					<div className="min-h-0 flex-1">
						<Board
							phase={s.phase}
							me={me}
							record={s.phase === 'combat' ? record : null}
							playbackT={playbackT}
							pveWave={s.phase === 'planning' ? s.pveWave : null}
							dragKind={drag?.payload.kind ?? null}
							onUnitPointerDown={(e, uid) => startDrag(e, { kind: 'unit', uid })}
						/>
					</div>
					<div className="flex justify-center py-1">
						<Bench me={me} onUnitPointerDown={(e, uid) => startDrag(e, { kind: 'unit', uid })} />
					</div>
				</div>
				<PlayerList
					players={s.players}
					opponentId={s.phase === 'combat' ? record?.opponentId : null}
				/>
			</div>

			{/* 底部：装备栏 + 商店 */}
			<div className="flex items-end gap-3 px-3 pb-2">
				<ItemTray
					items={me.itemTray}
					onItemPointerDown={(e, itemApi) => startDrag(e, { kind: 'item', itemApi })}
				/>
				<div className="flex flex-1 justify-center">
					<Shop
						me={me}
						maxLevel={MAX_LEVEL}
						onBuy={(slot) => {
							if (!engine.buyShopSlot(0, slot)) toast.error('无法购买：金币不足或备战席已满')
						}}
						onRefresh={() => engine.refreshShop(0)}
						onBuyXp={() => engine.buyXp(0)}
						onToggleLock={() => engine.toggleShopLock(0)}
					/>
				</div>
			</div>

			{/* 出售区：拖棋子时出现 */}
			{drag?.payload.kind === 'unit' && (
				<div
					data-sell-zone
					className="fixed right-44 top-1/2 z-40 flex h-24 w-24 -translate-y-1/2 flex-col items-center justify-center rounded-lg border-2 border-dashed border-red-500/80 bg-red-950/60 text-sm font-bold text-red-300"
				>
					拖到此处
					<br />
					出售
				</div>
			)}

			{s.phase === 'carousel' && (
				<Carousel
					state={s}
					onPick={(i) => {
						if (!engine.pickCarousel(0, i)) toast.info('还没轮到你')
					}}
				/>
			)}
			{s.phase === 'encounter' && myOffers && (
				<AugmentModal
					mode="encounter"
					offers={myOffers}
					onPick={(api) => engine.pickAugment(0, api)}
				/>
			)}
			{s.phase === 'planning' && myOffers && (
				<AugmentModal
					mode="augment"
					offers={myOffers}
					onPick={(api) => engine.pickAugment(0, api)}
				/>
			)}
			{s.phase === 'ended' && (
				<EndScreen
					players={s.players}
					onRestart={() => tftStore.start()}
					onLobby={() => tftStore.quit()}
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
								const item = ITEM_BY_API.get(api)
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
					<li>· 技能按官方描述归类引擎近似还原；视觉为 2D 俯视棋盘</li>
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
