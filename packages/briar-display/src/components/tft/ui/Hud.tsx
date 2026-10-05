'use client'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { FastForward, Home, SkipForward } from 'lucide-react'
import type { CombatRecord } from '../engine/gameLoop'
import type { Phase } from '../engine/types'
import { StageTracker } from './StageTracker'

interface HudProps {
	phase: Phase
	stage: number
	round: number
	remainMs: number
	speed: number
	record: CombatRecord | null
	onSpeed: (s: number) => void
	onQuit: () => void
	/** debug 模式：额外高速档 + 跳阶段按钮 */
	debug?: boolean
	onSkip?: () => void
}

const PHASE_LABEL: Record<Phase, string> = {
	lobby: '大厅',
	encounter: '遭遇',
	carousel: '选秀',
	planning: '备战',
	combat: '战斗',
	ended: '结束',
}

/** 阶段/回合/倒计时/倍速/对手信息 */
export function Hud({
	phase,
	stage,
	round,
	remainMs,
	speed,
	record,
	onSpeed,
	onQuit,
	debug,
	onSkip,
}: HudProps) {
	const remain = Math.max(0, Math.ceil(remainMs / 1000))
	const myResult = record
		? record.result.winner === 'draw'
			? '平局'
			: (record.result.winner === 'A') === (record.playerSide === 'A')
				? '胜利'
				: '失败'
		: null
	return (
		<div className="flex items-center gap-3 text-sm">
			<span className="font-mono text-zinc-200">
				{stage}-{round}
			</span>
			<StageTracker stage={stage} round={round} />
			<span
				className={cn(
					'rounded px-2 py-0.5 text-xs font-bold',
					phase === 'combat'
						? 'bg-red-900/60 text-red-200'
						: phase === 'planning'
							? 'bg-emerald-900/60 text-emerald-200'
							: 'bg-zinc-700 text-zinc-200',
				)}
			>
				{PHASE_LABEL[phase]} {remain > 0 && `${remain}s`}
			</span>
			{phase === 'combat' && record && (
				<span className="text-xs text-zinc-400">
					vs {record.opponentName}
					{record.isGhost && '（镜像）'}
				</span>
			)}
			{phase !== 'combat' && record && myResult && (
				<span
					className={cn(
						'text-xs font-bold',
						myResult === '胜利'
							? 'text-green-400'
							: myResult === '失败'
								? 'text-red-400'
								: 'text-zinc-400',
					)}
				>
					上回合：{myResult}
				</span>
			)}
			<div className="ml-auto flex items-center gap-1.5">
				{(debug ? [1, 2, 4, 8, 16] : [1, 2, 4]).map((s) => (
					<Button
						key={s}
						size="sm"
						variant={speed === s ? 'default' : 'ghost'}
						onClick={() => onSpeed(s)}
						className={cn('h-7 px-2', speed !== s && 'text-zinc-300')}
					>
						<FastForward className="mr-0.5 h-3 w-3" />
						{s}x
					</Button>
				))}
				{debug && onSkip && (
					<Button
						size="sm"
						variant="ghost"
						onClick={onSkip}
						className="h-7 px-2 text-amber-300"
						title="跳过当前阶段（debug）"
					>
						<SkipForward className="h-3.5 w-3.5" />
					</Button>
				)}
				<Button
					size="sm"
					variant="ghost"
					onClick={onQuit}
					className="h-7 px-2 text-zinc-300"
					title="返回大厅"
				>
					<Home className="h-3.5 w-3.5" />
				</Button>
			</div>
		</div>
	)
}
