'use client'

import {
	type CertInfo,
	type CertRenewalItem,
	type CertStatus,
	type DeployHistoryItem,
	getCertRenewals,
	getCertStatus,
	getDeployHistory,
	triggerNginxDeploy,
} from '@/api/deploy'
import AdminLayout from '@/components/admin/AdminLayout'
import DeployLogDialog from '@/components/admin/DeployLogDialog'
import SchedulerTasksCard from '@/components/admin/SchedulerTasksCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PermissionProvider } from '@/contexts/PermissionContext'
import { useRequirePermission } from '@/hooks/useRequirePermission'
import {
	AlertTriangle,
	FileBadge,
	FileTerminal,
	Globe,
	Loader2,
	RefreshCw,
	Rocket,
	Server,
	ShieldCheck,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

const PAGE_PATH = '/briar/admin/deploy'

function formatTime(date: string) {
	return new Date(date).toLocaleString('zh-CN', { hour12: false })
}

function daysBadge(days: number) {
	if (days < 0) return <Badge className="bg-red-100 text-red-700">已过期</Badge>
	if (days <= 7) return <Badge className="bg-red-100 text-red-700">剩 {days} 天</Badge>
	if (days <= 30) return <Badge className="bg-yellow-100 text-yellow-700">剩 {days} 天</Badge>
	return <Badge className="bg-green-100 text-green-700">剩 {days} 天</Badge>
}

const RENEWAL_STATUS: Record<CertRenewalItem['status'], { label: string; className: string }> = {
	running: { label: '运行中', className: 'bg-blue-100 text-blue-700' },
	success: { label: '成功', className: 'bg-green-100 text-green-700' },
	skipped: { label: '跳过', className: 'bg-gray-100 text-gray-600' },
	failed: { label: '失败', className: 'bg-red-100 text-red-700' },
}

const TRIGGER_LABEL: Record<CertRenewalItem['triggerType'], string> = {
	scheduled: '定时任务',
	manual: '手动触发',
}

const RUNNING_DEPLOY_STATUS = ['in_progress', 'queued', 'waiting', 'requested']

function deployStatusBadge(status: string) {
	if (status === 'success') return <Badge className="bg-green-100 text-green-700">成功</Badge>
	if (status === 'failure') return <Badge className="bg-red-100 text-red-700">失败</Badge>
	if (status === 'cancelled') return <Badge className="bg-gray-100 text-gray-600">已取消</Badge>
	if (RUNNING_DEPLOY_STATUS.includes(status)) {
		return <Badge className="animate-pulse bg-blue-100 text-blue-700">进行中</Badge>
	}
	return <Badge className="bg-gray-100 text-gray-600">{status}</Badge>
}

function CertInfoBlock({
	title,
	icon,
	info,
}: { title: string; icon: React.ReactNode; info: CertInfo | null }) {
	return (
		<div className="rounded-md border p-4">
			<div className="mb-3 flex items-center gap-2 text-sm font-medium">
				{icon}
				{title}
			</div>
			{info ? (
				<dl className="space-y-1.5 text-xs">
					<div className="flex justify-between gap-2">
						<dt className="text-muted-foreground">通用名称</dt>
						<dd className="font-mono">{info.commonName}</dd>
					</div>
					<div className="flex justify-between gap-2">
						<dt className="text-muted-foreground">签发者</dt>
						<dd className="font-mono">{info.issuer}</dd>
					</div>
					<div className="flex justify-between gap-2">
						<dt className="text-muted-foreground">生效时间</dt>
						<dd>{formatTime(info.notBefore)}</dd>
					</div>
					<div className="flex justify-between gap-2">
						<dt className="text-muted-foreground">过期时间</dt>
						<dd>{formatTime(info.notAfter)}</dd>
					</div>
					<div className="flex items-center justify-between gap-2">
						<dt className="text-muted-foreground">有效期</dt>
						<dd>{daysBadge(info.daysRemaining)}</dd>
					</div>
				</dl>
			) : (
				<p className="py-3 text-center text-xs text-muted-foreground">未获取到证书信息</p>
			)}
		</div>
	)
}

export default function AdminDeployPage() {
	return (
		<PermissionProvider>
			<AdminDeployPageInner />
		</PermissionProvider>
	)
}

function AdminDeployPageInner() {
	const { loading: permLoading, denied } = useRequirePermission('admin:deploy:manage')

	const [certStatus, setCertStatus] = useState<CertStatus | null>(null)
	const [renewals, setRenewals] = useState<CertRenewalItem[]>([])
	const [history, setHistory] = useState<DeployHistoryItem[]>([])
	const [loading, setLoading] = useState(true)
	const [nginxDeploying, setNginxDeploying] = useState(false)
	const [logRunId, setLogRunId] = useState<string | null>(null)
	const [logOpen, setLogOpen] = useState(false)
	const wasRunningRef = useRef(false)

	const fetchStatus = useCallback(async () => {
		const res = await getCertStatus()
		if (res.success && res.data) setCertStatus(res.data)
	}, [])

	const fetchRenewals = useCallback(async () => {
		const res = await getCertRenewals()
		if (res.success && res.data) setRenewals(res.data.items)
	}, [])

	const fetchHistory = useCallback(async () => {
		const res = await getDeployHistory()
		if (res.success && res.data) setHistory(res.data.items)
	}, [])

	useEffect(() => {
		Promise.all([fetchStatus(), fetchRenewals(), fetchHistory()]).finally(() => setLoading(false))
	}, [fetchStatus, fetchRenewals, fetchHistory])

	// 有进行中的部署时轮询列表，状态翻转后自动停止
	const hasRunningDeploy = history.some((h) => RUNNING_DEPLOY_STATUS.includes(h.status))
	useEffect(() => {
		if (!hasRunningDeploy) return
		const timer = setInterval(fetchHistory, 10000)
		return () => clearInterval(timer)
	}, [hasRunningDeploy, fetchHistory])

	// 有 running 状态的续期记录时轮询，结束后提示结果并刷新证书状态
	const hasRunning = renewals.some((r) => r.status === 'running')
	useEffect(() => {
		if (!hasRunning) return
		const timer = setInterval(fetchRenewals, 5000)
		return () => clearInterval(timer)
	}, [hasRunning, fetchRenewals])

	useEffect(() => {
		if (wasRunningRef.current && !hasRunning && renewals.length > 0) {
			const latest = renewals[0]
			if (latest.status === 'success') {
				toast.success('证书续期成功')
			} else if (latest.status === 'failed') {
				toast.error(`证书续期失败：${latest.message || '未知错误'}`)
			} else if (latest.status === 'skipped') {
				toast.info('证书尚未到期，已跳过续期')
			}
			fetchStatus()
		}
		wasRunningRef.current = hasRunning
	}, [hasRunning, renewals, fetchStatus])

	const handleNginxDeploy = async () => {
		setNginxDeploying(true)
		try {
			const res = await triggerNginxDeploy()
			if (res.success && res.data) {
				toast.success(
					<div className="space-y-1">
						<p>Nginx 部署任务已启动</p>
						<a
							href={res.data.url}
							target="_blank"
							rel="noopener noreferrer"
							className="text-xs underline"
						>
							查看运行日志
						</a>
					</div>,
				)
				// 刷新部署记录列表
				setTimeout(fetchHistory, 3000)
			} else {
				toast.error(res.message || '触发 Nginx 部署失败')
			}
		} catch {
			toast.error('触发 Nginx 部署失败')
		} finally {
			setNginxDeploying(false)
		}
	}

	if (permLoading) {
		return (
			<AdminLayout currentPath={PAGE_PATH}>
				<div className="flex items-center justify-center py-20">
					<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
				</div>
			</AdminLayout>
		)
	}

	if (denied) {
		return (
			<AdminLayout currentPath={PAGE_PATH}>
				<div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
					<AlertTriangle className="h-5 w-5" />
					<span>你没有权限访问此页面</span>
				</div>
			</AdminLayout>
		)
	}

	const certConsistent =
		certStatus?.local && certStatus?.live && certStatus.local.notAfter === certStatus.live.notAfter

	return (
		<AdminLayout currentPath={PAGE_PATH}>
			{/* 证书状态 */}
			<div className="mb-4 rounded-md border bg-card p-4">
				<div className="mb-4 flex items-center gap-2">
					<ShieldCheck className="h-4 w-4 text-muted-foreground" />
					<h2 className="text-sm font-semibold">证书状态</h2>
					{certStatus && (
						<span className="font-mono text-xs text-muted-foreground">{certStatus.domain}</span>
					)}
					{certStatus?.local &&
						certStatus?.live &&
						(certConsistent ? (
							<Badge className="bg-green-100 text-green-700">本地与线上一致</Badge>
						) : (
							<Badge className="bg-yellow-100 text-yellow-700">本地与线上不一致</Badge>
						))}
				</div>
				{loading ? (
					<div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
						<Loader2 className="h-4 w-4 animate-spin" />
						加载中...
					</div>
				) : (
					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
						<CertInfoBlock
							title="本地证书（即将部署）"
							icon={<FileBadge className="h-4 w-4 text-muted-foreground" />}
							info={certStatus?.local ?? null}
						/>
						<CertInfoBlock
							title="线上证书（实际服役）"
							icon={<Globe className="h-4 w-4 text-muted-foreground" />}
							info={certStatus?.live ?? null}
						/>
					</div>
				)}
			</div>

			{/* 定时任务 */}
			<SchedulerTasksCard />

			{/* Nginx 配置部署 */}
			<div className="mb-4 rounded-md border bg-card p-4">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<Server className="h-4 w-4 text-muted-foreground" />
						<h2 className="text-sm font-semibold">Nginx 配置</h2>
					</div>
					<Button
						size="sm"
						onClick={handleNginxDeploy}
						disabled={nginxDeploying}
						className="gap-1.5"
					>
						{nginxDeploying ? (
							<Loader2 className="h-3.5 w-3.5 animate-spin" />
						) : (
							<Rocket className="h-3.5 w-3.5" />
						)}
						{nginxDeploying ? '部署中...' : '重新部署 Nginx'}
					</Button>
				</div>
				<p className="mt-2 text-xs text-muted-foreground">
					将本地 default.conf 同步到服务器 /etc/nginx/ 并重载
					nginx。默认不会自动执行，仅在手动点击后触发。
				</p>
			</div>

			{/* 续期记录 */}
			<div className="mb-4 rounded-md border bg-card p-4">
				<div className="mb-3 flex items-center gap-2">
					<RefreshCw className="h-4 w-4 text-muted-foreground" />
					<h2 className="text-sm font-semibold">续期记录</h2>
				</div>
				{loading ? (
					<div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
						<Loader2 className="h-4 w-4 animate-spin" />
						加载中...
					</div>
				) : renewals.length === 0 ? (
					<p className="py-8 text-center text-xs text-muted-foreground">暂无续期记录</p>
				) : (
					<div className="rounded-md border">
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b bg-muted/50">
									<th className="px-3 py-2 text-left font-medium text-muted-foreground">
										开始时间
									</th>
									<th className="px-3 py-2 text-left font-medium text-muted-foreground">
										触发方式
									</th>
									<th className="px-3 py-2 text-left font-medium text-muted-foreground">状态</th>
									<th className="px-3 py-2 text-right font-medium text-muted-foreground">耗时</th>
									<th className="hidden px-3 py-2 text-left font-medium text-muted-foreground lg:table-cell">
										信息
									</th>
								</tr>
							</thead>
							<tbody className="divide-y">
								{renewals.map((item) => {
									const status = RENEWAL_STATUS[item.status]
									const duration = item.finishedAt
										? Math.round(
												(new Date(item.finishedAt).getTime() - new Date(item.startedAt).getTime()) /
													1000,
											)
										: null
									return (
										<tr key={item.id}>
											<td className="whitespace-nowrap px-3 py-2 font-mono text-xs">
												{formatTime(item.startedAt)}
											</td>
											<td className="px-3 py-2 text-xs">{TRIGGER_LABEL[item.triggerType]}</td>
											<td className="px-3 py-2">
												<Badge variant="secondary" className={`text-[11px] ${status.className}`}>
													{status.label}
												</Badge>
											</td>
											<td className="whitespace-nowrap px-3 py-2 text-right font-mono text-xs">
												{duration === null
													? '-'
													: duration >= 60
														? `${Math.floor(duration / 60)}m${duration % 60}s`
														: `${duration}s`}
											</td>
											<td
												className="hidden max-w-[300px] truncate px-3 py-2 text-xs text-muted-foreground lg:table-cell"
												title={item.message || ''}
											>
												{item.message || '-'}
											</td>
										</tr>
									)
								})}
							</tbody>
						</table>
					</div>
				)}
			</div>

			{/* 部署记录 */}
			<div className="rounded-md border bg-card p-4">
				<div className="mb-3 flex items-center gap-2">
					<Rocket className="h-4 w-4 text-muted-foreground" />
					<h2 className="text-sm font-semibold">部署记录</h2>
				</div>
				{loading ? (
					<div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
						<Loader2 className="h-4 w-4 animate-spin" />
						加载中...
					</div>
				) : history.length === 0 ? (
					<p className="py-8 text-center text-xs text-muted-foreground">
						暂无部署记录（deploy-history.jsonl 仅存在于服务器）
					</p>
				) : (
					<div className="rounded-md border">
						<table className="w-full text-sm">
							<thead>
								<tr className="border-b bg-muted/50">
									<th className="px-3 py-2 text-left font-medium text-muted-foreground">时间</th>
									<th className="px-3 py-2 text-left font-medium text-muted-foreground">Commit</th>
									<th className="px-3 py-2 text-left font-medium text-muted-foreground">触发者</th>
									<th className="px-3 py-2 text-left font-medium text-muted-foreground">状态</th>
									<th className="px-3 py-2 text-right font-medium text-muted-foreground">操作</th>
								</tr>
							</thead>
							<tbody className="divide-y">
								{history.map((item, index) => (
									<tr key={`${item.run}-${index}`}>
										<td className="whitespace-nowrap px-3 py-2 font-mono text-xs">
											{formatTime(item.at)}
										</td>
										<td className="px-3 py-2 font-mono text-xs">{item.commit.slice(0, 7)}</td>
										<td className="px-3 py-2 text-xs">{item.actor}</td>
										<td className="px-3 py-2">{deployStatusBadge(item.status)}</td>
										<td className="px-3 py-2 text-right">
											{item.run && (
												<Button
													variant="ghost"
													size="sm"
													className="h-7 gap-1 px-2 text-xs"
													onClick={() => {
														setLogRunId(item.run)
														setLogOpen(true)
													}}
												>
													<FileTerminal className="h-3.5 w-3.5" />
													发布日志
												</Button>
											)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>
			<DeployLogDialog runId={logRunId} open={logOpen} onOpenChange={setLogOpen} />
		</AdminLayout>
	)
}
