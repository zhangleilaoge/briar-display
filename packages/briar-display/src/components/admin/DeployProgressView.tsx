'use client'

import type { DeployRunProgress } from '@/api/deploy'
import { cn } from '@/lib/utils'
import { CheckCircle2, Circle, Loader2, MinusCircle, XCircle } from 'lucide-react'

interface DeployProgressViewProps {
	progress: DeployRunProgress
	/** 服务器 deploy.sh 行级输出（不属于本次 run 时传 null） */
	liveLines: string[] | null
}

/** 毫秒 → "45s" / "3m12s" */
function fmtDuration(ms: number): string {
	const s = Math.max(0, Math.round(ms / 1000))
	if (s < 60) return `${s}s`
	return `${Math.floor(s / 60)}m${s % 60}s`
}

function StepIcon({ status, conclusion }: { status: string; conclusion: string | null }) {
	if (status !== 'completed') {
		return status === 'in_progress' ? (
			<Loader2 className="h-4 w-4 animate-spin text-blue-400" />
		) : (
			<Circle className="h-4 w-4 text-zinc-600" />
		)
	}
	if (conclusion === 'success') return <CheckCircle2 className="h-4 w-4 text-green-400" />
	if (conclusion === 'skipped') return <MinusCircle className="h-4 w-4 text-zinc-500" />
	return <XCircle className="h-4 w-4 text-red-400" />
}

/** 部署进行中的实时视图：步骤时间线（jobs API）+ 服务器行级输出（deploy.sh 进度文件） */
export default function DeployProgressView({ progress, liveLines }: DeployProgressViewProps) {
	const allSteps = progress.jobs.flatMap((j) => j.steps)
	const doneCount = allSteps.filter((s) => s.status === 'completed').length
	const totalCount = allSteps.length
	const percent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0
	const now = Date.now()

	return (
		<div className="space-y-4">
			{/* 总进度条 */}
			<div className="space-y-1.5">
				<div className="flex items-center justify-between text-[11px] text-zinc-400">
					<span>
						{totalCount > 0 ? `步骤 ${doneCount}/${totalCount}` : '排队中，等待 runner...'}
					</span>
					<span>{totalCount > 0 ? `${percent}%` : ''}</span>
				</div>
				<div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
					<div
						className="h-full rounded-full bg-blue-500 transition-all duration-500"
						style={{ width: `${percent}%` }}
					/>
				</div>
			</div>

			{/* 步骤时间线 */}
			{progress.jobs.map((job) => (
				<div key={job.name} className="space-y-1">
					{job.steps.map((step) => {
						const running = step.status !== 'completed' && step.startedAt
						const duration = step.completedAt
							? fmtDuration(
									new Date(step.completedAt).getTime() -
										new Date(step.startedAt ?? step.completedAt).getTime(),
								)
							: running
								? fmtDuration(now - new Date(step.startedAt).getTime())
								: null
						return (
							<div
								key={step.number}
								className={cn(
									'flex items-center gap-2.5 rounded px-2 py-1.5',
									step.status === 'in_progress' && 'bg-blue-500/10',
								)}
							>
								<StepIcon status={step.status} conclusion={step.conclusion} />
								<span
									className={cn(
										'flex-1',
										step.status === 'completed'
											? 'text-zinc-300'
											: step.status === 'in_progress'
												? 'text-blue-300'
												: 'text-zinc-600',
									)}
								>
									{step.name}
								</span>
								{duration && (
									<span className="text-[11px] text-zinc-500">
										{duration}
										{step.status === 'in_progress' && ' ...'}
									</span>
								)}
							</div>
						)
					})}
				</div>
			))}

			{/* 服务器 deploy.sh 行级实时输出 */}
			{liveLines && liveLines.length > 0 && (
				<div className="space-y-1.5">
					<p className="text-[11px] text-zinc-500">服务器实时输出（deploy.sh）</p>
					<div className="max-h-48 overflow-auto rounded border border-zinc-800 bg-zinc-900/60 p-2.5">
						{liveLines.map((line, i) => (
							// 行内容可能重复（重试场景），用索引兜底
							// biome-ignore lint/suspicious/noArrayIndexKey: 日志行无唯一 id
							<p key={i} className="whitespace-pre-wrap text-zinc-300">
								{line}
							</p>
						))}
					</div>
				</div>
			)}
		</div>
	)
}
