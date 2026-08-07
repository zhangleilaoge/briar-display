'use client'

import { type HostInfo, getHostInfo } from '@/api/terminal'
import { Button } from '@/components/ui/button'
import { Cpu, HardDrive, MemoryStick, RefreshCw, Server } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

const REFRESH_INTERVAL = 15_000

function UsageBar({ percent, tone }: { percent: number; tone?: 'auto' }) {
	const clamped = Math.min(100, Math.max(0, percent))
	const color = clamped >= 90 ? 'bg-red-500' : clamped >= 70 ? 'bg-yellow-500' : 'bg-emerald-500'
	return (
		<div className="h-1.5 w-full overflow-hidden rounded-full bg-[#2a2a2a]">
			<div
				className={`h-full rounded-full transition-all ${color}`}
				style={{ width: `${clamped}%` }}
			/>
		</div>
	)
}

function StatCard({
	icon: Icon,
	title,
	children,
}: {
	icon: typeof Cpu
	title: string
	children: React.ReactNode
}) {
	return (
		<div className="rounded-lg border border-[#2d2d2d] bg-[#161616] p-3">
			<div className="mb-2 flex items-center gap-1.5 text-xs text-gray-400">
				<Icon className="h-3.5 w-3.5" />
				{title}
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
		<div className="rounded-lg border border-[#2d2d2d] bg-[#0c0c0c] p-3">
			<div className="mb-3 flex items-center justify-between">
				<div className="flex items-center gap-2 text-xs text-gray-400">
					<Server className="h-3.5 w-3.5" />
					<span>服务器状态</span>
					{info && (
						<span className="text-gray-600">
							{info.hostname} · 更新于 {new Date(info.collectedAt).toLocaleTimeString()}
						</span>
					)}
				</div>
				<Button
					variant="ghost"
					size="sm"
					className="h-6 gap-1 px-2 text-xs text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200"
					onClick={() => void refresh(true)}
					disabled={refreshing}
				>
					<RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
					刷新
				</Button>
			</div>

			{error && !info ? (
				<p className="py-4 text-center text-xs text-red-400">{error}</p>
			) : !info ? (
				<p className="py-4 text-center text-xs text-gray-500">正在采集服务器信息...</p>
			) : (
				<div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
					<StatCard icon={Server} title="系统">
						<p className="truncate text-sm text-gray-200" title={info.os}>
							{info.os || '-'}
						</p>
						<p className="mt-1 truncate text-xs text-gray-500" title={info.cpuModel}>
							{info.cpuModel || '-'}
						</p>
						<p className="mt-0.5 text-xs text-gray-500">已运行 {info.uptime || '-'}</p>
					</StatCard>

					<StatCard icon={Cpu} title={`CPU 负载（${info.cpuCores} 核）`}>
						<p className="text-sm text-gray-200">
							{info.load.map((n) => n.toFixed(2)).join(' / ')}
						</p>
						<div className="mt-2">
							<UsageBar percent={loadPercent} />
						</div>
						<p className="mt-1 text-xs text-gray-500">1 / 5 / 15 分钟均值</p>
					</StatCard>

					<StatCard icon={MemoryStick} title="内存">
						<p className="text-sm text-gray-200">
							{(info.mem.usedMb / 1024).toFixed(1)} / {(info.mem.totalMb / 1024).toFixed(1)} GB
						</p>
						<div className="mt-2">
							<UsageBar percent={memPercent} />
						</div>
						<p className="mt-1 text-xs text-gray-500">已用 {memPercent.toFixed(0)}%</p>
					</StatCard>

					<StatCard icon={HardDrive} title={`硬盘（${info.disk.mount}）`}>
						<p className="text-sm text-gray-200">
							{info.disk.used} / {info.disk.size}
						</p>
						<div className="mt-2">
							<UsageBar percent={info.disk.usePercent} />
						</div>
						<p className="mt-1 text-xs text-gray-500">可用 {info.disk.avail}</p>
					</StatCard>
				</div>
			)}
		</div>
	)
}
