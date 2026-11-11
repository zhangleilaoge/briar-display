'use client'

import { type HostInfo, getHostInfo } from '@/api/terminal'
import { Button } from '@/components/ui/button'
import { Cpu, HardDrive, MemoryStick, RefreshCw, Server } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

const REFRESH_INTERVAL = 15_000

function UsageBar({ percent }: { percent: number }) {
	const clamped = Math.min(100, Math.max(0, percent))
	const color =
		clamped >= 90
			? 'bg-red-400'
			: clamped >= 70
				? 'bg-amber-400'
				: 'bg-gradient-to-r from-emerald-500 to-teal-400'
	return (
		<div
			role="progressbar"
			tabIndex={0}
			aria-label={`使用率 ${clamped.toFixed(0)}%`}
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuenow={Math.round(clamped)}
			className="h-1.5 w-full overflow-hidden rounded-full bg-white/10"
		>
			<div
				className={`h-full rounded-full transition-[width] duration-500 ${color}`}
				style={{ width: `${clamped}%` }}
			/>
		</div>
	)
}

function StatCell({
	icon: Icon,
	title,
	children,
}: {
	icon: typeof Cpu
	title: string
	children: React.ReactNode
}) {
	return (
		<div className="bg-[var(--term-bg)] p-4">
			<div className="mb-3 flex items-center gap-2 text-xs text-[var(--term-muted)]">
				<span className="flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-sky-300">
					<Icon className="h-3.5 w-3.5" aria-hidden />
				</span>
				<span className="font-medium tracking-wide">{title}</span>
			</div>
			{children}
		</div>
	)
}

/** 服务器信息面板：系统 / CPU 负载 / 内存 / 硬盘，15s 自动刷新 */
export default function HostInfoPanel() {
	const [info, setInfo] = useState<HostInfo | null>(null)
	const [error, setError] = useState('')
	const [refreshing, setRefreshing] = useState(false)
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

	const refresh = useCallback(async (manual = false) => {
		if (manual) setRefreshing(true)
		try {
			const res = await getHostInfo()
			if (res.success && res.data) {
				setInfo(res.data)
				setError('')
			} else {
				setError(res.message || '获取失败')
			}
		} catch {
			setError('获取服务器信息失败')
		} finally {
			if (manual) setRefreshing(false)
		}
	}, [])

	useEffect(() => {
		void refresh()
		timerRef.current = setInterval(() => void refresh(), REFRESH_INTERVAL)
		return () => {
			if (timerRef.current) clearInterval(timerRef.current)
		}
	}, [refresh])

	const memPercent = info?.mem.totalMb ? (info.mem.usedMb / info.mem.totalMb) * 100 : 0
	const loadPercent = info?.cpuCores ? Math.min(100, (info.load[0] / info.cpuCores) * 100) : 0

	return (
		<section
			aria-label="服务器状态"
			className="rv-terminal overflow-hidden rounded-xl border border-[var(--term-border)] bg-[var(--term-bg)] shadow-[0_12px_32px_rgba(3,7,18,0.14)]"
		>
			<div className="flex flex-col gap-2 border-b border-[var(--term-border)] bg-[var(--term-bg-raised)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
					<div className="flex items-center gap-2 text-xs font-medium text-[var(--term-title)]">
						<span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.45)]" />
						<Server className="h-3.5 w-3.5 text-sky-300" aria-hidden />
						<span>服务器状态</span>
					</div>
					{info && (
						<span className="truncate font-mono text-[11px] text-[var(--term-dim)]">
							{info.hostname} · 更新于 {new Date(info.collectedAt).toLocaleTimeString()}
						</span>
					)}
				</div>
				<Button
					variant="default"
					size="sm"
					className="h-7 gap-1.5 self-start border-[var(--term-border)] bg-transparent px-2.5 text-xs text-[var(--term-muted)] shadow-none hover:bg-white/10 hover:text-[var(--term-title)] sm:self-auto"
					onClick={() => void refresh(true)}
					disabled={refreshing}
				>
					<RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
					刷新
				</Button>
			</div>

			{error && !info ? (
				<p className="py-6 text-center text-xs text-red-300">{error}</p>
			) : !info ? (
				<p className="py-6 text-center text-xs text-[var(--term-muted)]">正在采集服务器信息...</p>
			) : (
				<div className="grid grid-cols-1 gap-px bg-[var(--term-border)] sm:grid-cols-2 xl:grid-cols-4">
					<StatCell icon={Server} title="操作系统">
						<p
							className="truncate font-mono text-sm font-medium text-[var(--term-title)]"
							title={info.os}
						>
							{info.os || '-'}
						</p>
						<p className="mt-2 truncate text-xs text-[var(--term-muted)]" title={info.cpuModel}>
							{info.cpuModel || '-'}
						</p>
						<p className="mt-1 text-xs text-[var(--term-dim)]">已运行 {info.uptime || '-'}</p>
					</StatCell>

					<StatCell icon={Cpu} title={`CPU 负载 · ${info.cpuCores} 核`}>
						<p className="font-mono text-lg font-medium tracking-tight text-[var(--term-title)]">
							{info.load.map((n) => n.toFixed(2)).join(' / ')}
						</p>
						<div className="mt-2.5">
							<UsageBar percent={loadPercent} />
						</div>
						<p className="mt-2 text-xs text-[var(--term-dim)]">1 / 5 / 15 分钟均值</p>
					</StatCell>

					<StatCell icon={MemoryStick} title="内存">
						<p className="font-mono text-lg font-medium tracking-tight text-[var(--term-title)]">
							{(info.mem.usedMb / 1024).toFixed(1)} / {(info.mem.totalMb / 1024).toFixed(1)} GB
						</p>
						<div className="mt-2.5">
							<UsageBar percent={memPercent} />
						</div>
						<p className="mt-2 text-xs text-[var(--term-dim)]">已用 {memPercent.toFixed(0)}%</p>
					</StatCell>

					<StatCell icon={HardDrive} title={`硬盘 · ${info.disk.mount}`}>
						<p className="font-mono text-lg font-medium tracking-tight text-[var(--term-title)]">
							{info.disk.used} / {info.disk.size}
						</p>
						<div className="mt-2.5">
							<UsageBar percent={info.disk.usePercent} />
						</div>
						<p className="mt-2 text-xs text-[var(--term-dim)]">可用 {info.disk.avail}</p>
					</StatCell>
				</div>
			)}
		</section>
	)
}
