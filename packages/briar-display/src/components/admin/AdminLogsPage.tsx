'use client'

import { type RequestLogItem, getLogStats, getLogs } from '@/api/admin'
import AdminLayout from '@/components/admin/AdminLayout'
import AdminPagination from '@/components/admin/AdminPagination'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PermissionProvider } from '@/contexts/PermissionContext'
import { useRequirePermission } from '@/hooks/useRequirePermission'
import {
	Activity,
	AlertTriangle,
	Check,
	ChevronDown,
	ChevronRight,
	Clock,
	Copy,
	Loader2,
	Radio,
	RefreshCw,
	Search,
	Timer,
	Zap,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

const PAGE_SIZE = 50

const METHOD_COLORS: Record<string, string> = {
	GET: 'bg-blue-100 text-blue-700',
	POST: 'bg-green-100 text-green-700',
	PUT: 'bg-orange-100 text-orange-700',
	DELETE: 'bg-red-100 text-red-700',
	PATCH: 'bg-purple-100 text-purple-700',
}

function statusColor(s: number) {
	if (s >= 500) return 'bg-red-100 text-red-700'
	if (s >= 400) return 'bg-yellow-100 text-yellow-700'
	if (s >= 300) return 'bg-cyan-100 text-cyan-700'
	return 'bg-green-100 text-green-700'
}

function durationColor(ms: number) {
	if (ms > 1000) return 'text-red-600'
	if (ms > 200) return 'text-yellow-600'
	return 'text-green-600'
}

function formatTime(date: string | Date) {
	const d = typeof date === 'string' ? new Date(date) : date
	return d.toLocaleTimeString('zh-CN', {
		hour12: false,
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
	})
}

function formatFullTime(date: string | Date) {
	const d = typeof date === 'string' ? new Date(date) : date
	return d.toLocaleString('zh-CN', { hour12: false })
}

function timeRangeToISO(range: string): string | undefined {
	const now = new Date()
	switch (range) {
		case '1h':
			return new Date(now.getTime() - 3600000).toISOString()
		case '6h':
			return new Date(now.getTime() - 21600000).toISOString()
		case '24h':
			return new Date(now.getTime() - 86400000).toISOString()
		case '7d':
			return new Date(now.getTime() - 604800000).toISOString()
		default:
			return undefined
	}
}

export default function AdminLogsPage() {
	return (
		<PermissionProvider>
			<AdminLogsPageInner />
		</PermissionProvider>
	)
}

function AdminLogsPageInner() {
	const { loading: permLoading, denied } = useRequirePermission('admin:role:manage')
	const [logs, setLogs] = useState<RequestLogItem[]>([])
	const [total, setTotal] = useState(0)
	const [offset, setOffset] = useState(0)
	const [loading, setLoading] = useState(true)
	const [expandedId, setExpandedId] = useState<string | null>(null)
	const [copiedTraceId, setCopiedTraceId] = useState<string | null>(null)

	// Filters
	const [traceId, setTraceId] = useState('')
	const [method, setMethod] = useState('')
	const [statusGroup, setStatusGroup] = useState('')
	const [pathSearch, setPathSearch] = useState('')
	const [timeRange, setTimeRange] = useState('24h')
	const [autoRefresh, setAutoRefresh] = useState(false)

	// Stats
	const [stats, setStats] = useState({
		todayTotal: 0,
		todayErrors: 0,
		avgDuration: 0,
		slowCount: 0,
	})

	const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null)

	const fetchLogs = useCallback(async () => {
		const res = await getLogs({
			method: method || undefined,
			path: pathSearch || undefined,
			statusGroup: statusGroup || undefined,
			traceId: traceId || undefined,
			startTime: timeRangeToISO(timeRange),
			limit: PAGE_SIZE,
			offset,
		})
		if (res.success && res.data) {
			setLogs(res.data.items)
			setTotal(res.data.total)
		}
		setLoading(false)
	}, [method, pathSearch, statusGroup, traceId, timeRange, offset])

	const fetchStats = useCallback(async () => {
		const res = await getLogStats()
		if (res.success && res.data) setStats(res.data)
	}, [])

	useEffect(() => {
		setLoading(true)
		setOffset(0)
		fetchLogs()
		fetchStats()
	}, [method, pathSearch, statusGroup, traceId, timeRange])

	useEffect(() => {
		fetchLogs()
	}, [offset])

	useEffect(() => {
		if (autoRefresh) {
			refreshTimer.current = setInterval(() => {
				fetchLogs()
				fetchStats()
			}, 5000)
		}
		return () => {
			if (refreshTimer.current) clearInterval(refreshTimer.current)
		}
	}, [autoRefresh, fetchLogs, fetchStats])

	const handleCopyTraceId = (tid: string) => {
		navigator.clipboard.writeText(tid)
		setCopiedTraceId(tid)
		setTimeout(() => setCopiedTraceId(null), 2000)
	}

	if (permLoading) {
		return (
			<AdminLayout currentPath="/briar-display/admin/logs" title="天网日志">
				<div className="flex items-center justify-center py-20">
					<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
				</div>
			</AdminLayout>
		)
	}

	if (denied) {
		return (
			<AdminLayout currentPath="/briar-display/admin/logs" title="天网日志">
				<div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
					<AlertTriangle className="h-5 w-5" />
					<span>你没有权限访问此页面</span>
				</div>
			</AdminLayout>
		)
	}

	return (
		<AdminLayout currentPath="/briar-display/admin/logs" title="天网日志">
			{/* Stats cards */}
			<div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
				<div className="rounded-md border bg-card p-3">
					<div className="flex items-center gap-2 text-muted-foreground text-xs">
						<Activity className="h-3.5 w-3.5" /> 今日请求
					</div>
					<p className="mt-1 text-2xl font-semibold">{stats.todayTotal.toLocaleString()}</p>
				</div>
				<div className="rounded-md border bg-card p-3">
					<div className="flex items-center gap-2 text-muted-foreground text-xs">
						<AlertTriangle className="h-3.5 w-3.5" /> 错误数
					</div>
					<p className="mt-1 text-2xl font-semibold text-red-600">
						{stats.todayErrors.toLocaleString()}
						{stats.todayTotal > 0 && (
							<span className="ml-1 text-sm font-normal text-muted-foreground">
								({((stats.todayErrors / stats.todayTotal) * 100).toFixed(1)}%)
							</span>
						)}
					</p>
				</div>
				<div className="rounded-md border bg-card p-3">
					<div className="flex items-center gap-2 text-muted-foreground text-xs">
						<Timer className="h-3.5 w-3.5" /> 平均耗时
					</div>
					<p className={`mt-1 text-2xl font-semibold ${durationColor(stats.avgDuration)}`}>
						{stats.avgDuration}ms
					</p>
				</div>
				<div className="rounded-md border bg-card p-3">
					<div className="flex items-center gap-2 text-muted-foreground text-xs">
						<Zap className="h-3.5 w-3.5" /> 慢请求 (&gt;1s)
					</div>
					<p className="mt-1 text-2xl font-semibold text-yellow-600">
						{stats.slowCount.toLocaleString()}
					</p>
				</div>
			</div>

			{/* Filters */}
			<div className="mb-4 flex flex-wrap items-end gap-2 rounded-md border bg-card p-3">
				<div className="flex flex-col gap-1">
					<label className="text-[11px] text-muted-foreground">Trace ID</label>
					<Input
						value={traceId}
						onChange={(e) => setTraceId(e.target.value)}
						placeholder="粘贴 trace-id..."
						className="h-8 w-48 text-xs"
					/>
				</div>
				<div className="flex flex-col gap-1">
					<label className="text-[11px] text-muted-foreground">方法</label>
					<select
						value={method}
						onChange={(e) => setMethod(e.target.value)}
						className="h-8 rounded-md border border-input bg-background px-2 text-xs"
					>
						<option value="">全部</option>
						<option value="GET">GET</option>
						<option value="POST">POST</option>
						<option value="PUT">PUT</option>
						<option value="DELETE">DELETE</option>
					</select>
				</div>
				<div className="flex flex-col gap-1">
					<label className="text-[11px] text-muted-foreground">状态</label>
					<select
						value={statusGroup}
						onChange={(e) => setStatusGroup(e.target.value)}
						className="h-8 rounded-md border border-input bg-background px-2 text-xs"
					>
						<option value="">全部</option>
						<option value="2xx">2xx 成功</option>
						<option value="4xx">4xx 客户端错误</option>
						<option value="5xx">5xx 服务端错误</option>
					</select>
				</div>
				<div className="flex flex-col gap-1">
					<label className="text-[11px] text-muted-foreground">时间范围</label>
					<select
						value={timeRange}
						onChange={(e) => setTimeRange(e.target.value)}
						className="h-8 rounded-md border border-input bg-background px-2 text-xs"
					>
						<option value="1h">最近 1 小时</option>
						<option value="6h">最近 6 小时</option>
						<option value="24h">最近 24 小时</option>
						<option value="7d">最近 7 天</option>
						<option value="">全部</option>
					</select>
				</div>
				<div className="flex flex-col gap-1">
					<label className="text-[11px] text-muted-foreground">路径</label>
					<Input
						value={pathSearch}
						onChange={(e) => setPathSearch(e.target.value)}
						placeholder="搜索路径..."
						className="h-8 w-40 text-xs"
					/>
				</div>
				<div className="flex items-center gap-2">
					<Button
						variant={autoRefresh ? 'default' : 'outline'}
						size="sm"
						onClick={() => setAutoRefresh(!autoRefresh)}
						className="h-8 gap-1"
					>
						<RefreshCw className={`h-3.5 w-3.5 ${autoRefresh ? 'animate-spin' : ''}`} />
						{autoRefresh ? '自动刷新中' : '自动刷新'}
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={() => {
							fetchLogs()
							fetchStats()
						}}
						className="h-8 gap-1"
					>
						<Search className="h-3.5 w-3.5" />
						查询
					</Button>
				</div>
			</div>

			{/* Log table */}
			{loading ? (
				<div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
					<Loader2 className="h-5 w-5 animate-spin" />
					加载中...
				</div>
			) : logs.length === 0 ? (
				<div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
					<Radio className="h-10 w-10 opacity-30" />
					<p className="text-sm">暂无日志记录</p>
				</div>
			) : (
				<div className="rounded-md border">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-b bg-muted/50">
								<th className="w-8 px-2 py-2" />
								<th className="px-3 py-2 text-left font-medium text-muted-foreground">时间</th>
								<th className="px-3 py-2 text-left font-medium text-muted-foreground">方法</th>
								<th className="px-3 py-2 text-left font-medium text-muted-foreground">路径</th>
								<th className="px-3 py-2 text-left font-medium text-muted-foreground">状态</th>
								<th className="px-3 py-2 text-right font-medium text-muted-foreground">耗时</th>
								<th className="hidden px-3 py-2 text-left font-medium text-muted-foreground lg:table-cell">
									用户
								</th>
							</tr>
						</thead>
						<tbody className="divide-y">
							{logs.map((log) => {
								const isExpanded = expandedId === log.id
								return (
									<>
										<tr
											key={log.id}
											className={`cursor-pointer transition-colors hover:bg-muted/30 ${isExpanded ? 'bg-muted/20' : ''}`}
											onClick={() => setExpandedId(isExpanded ? null : log.id)}
										>
											<td className="px-2 py-2 text-muted-foreground">
												{isExpanded ? (
													<ChevronDown className="h-4 w-4" />
												) : (
													<ChevronRight className="h-4 w-4" />
												)}
											</td>
											<td
												className="whitespace-nowrap px-3 py-2"
												title={formatFullTime(log.createdAt)}
											>
												<span className="font-mono text-xs">{formatTime(log.createdAt)}</span>
											</td>
											<td className="px-3 py-2">
												<Badge
													variant="secondary"
													className={`text-[11px] ${METHOD_COLORS[log.method] || ''}`}
												>
													{log.method}
												</Badge>
											</td>
											<td
												className="max-w-[300px] truncate px-3 py-2 font-mono text-xs"
												title={log.path}
											>
												{log.path}
											</td>
											<td className="px-3 py-2">
												<Badge
													variant="secondary"
													className={`text-[11px] ${statusColor(log.status)}`}
												>
													{log.status}
												</Badge>
											</td>
											<td
												className={`whitespace-nowrap px-3 py-2 text-right font-mono text-xs ${durationColor(log.duration)}`}
											>
												{log.duration}ms
											</td>
											<td
												className="hidden px-3 py-2 font-mono text-xs text-muted-foreground lg:table-cell"
												title={log.userId || ''}
											>
												{log.userId?.slice(0, 8) || '-'}
											</td>
										</tr>
										{isExpanded && (
											<tr key={`${log.id}-detail`}>
												<td colSpan={7} className="border-b bg-muted/10 px-6 py-3">
													<div className="grid grid-cols-2 gap-4 text-xs">
														<div>
															<p className="mb-1 font-medium text-muted-foreground">Trace ID</p>
															<div className="flex items-center gap-2">
																<code className="rounded bg-muted px-2 py-0.5 font-mono">
																	{log.traceId}
																</code>
																<button
																	type="button"
																	onClick={(e) => {
																		e.stopPropagation()
																		handleCopyTraceId(log.traceId)
																	}}
																	className="text-muted-foreground hover:text-foreground"
																>
																	{copiedTraceId === log.traceId ? (
																		<Check className="h-3.5 w-3.5 text-green-600" />
																	) : (
																		<Copy className="h-3.5 w-3.5" />
																	)}
																</button>
															</div>
															{log.ip && (
																<div className="mt-2">
																	<p className="mb-0.5 font-medium text-muted-foreground">IP</p>
																	<code className="font-mono">{log.ip}</code>
																</div>
															)}
															{log.userAgent && (
																<div className="mt-2">
																	<p className="mb-0.5 font-medium text-muted-foreground">
																		User-Agent
																	</p>
																	<p className="break-all text-muted-foreground">{log.userAgent}</p>
																</div>
															)}
														</div>
														<div>
															{log.requestParams && Object.keys(log.requestParams).length > 0 && (
																<div>
																	<p className="mb-1 font-medium text-muted-foreground">请求参数</p>
																	<pre className="max-h-40 overflow-auto rounded bg-muted p-2 font-mono">
																		{JSON.stringify(log.requestParams, null, 2)}
																	</pre>
																</div>
															)}
															{log.errorMessage && (
																<div className="mt-2">
																	<p className="mb-0.5 font-medium text-red-600">错误信息</p>
																	<pre className="rounded border border-red-200 bg-red-50 p-2 text-red-700">
																		{log.errorMessage}
																	</pre>
																</div>
															)}
														</div>
													</div>
												</td>
											</tr>
										)}
									</>
								)
							})}
						</tbody>
					</table>
				</div>
			)}

			<AdminPagination
				total={total}
				limit={PAGE_SIZE}
				offset={offset}
				onPageChange={setOffset}
				className="mt-4"
			/>
		</AdminLayout>
	)
}
