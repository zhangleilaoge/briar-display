'use client'

import {
	clearDeviceToken,
	getDeviceTokenExpiry,
	isDeviceAuthorized,
	saveDeviceToken,
} from '@/api/terminal'
import AdminLayout from '@/components/admin/AdminLayout'
import DeviceGate from '@/components/admin/terminal/DeviceGate'
import HostInfoPanel from '@/components/admin/terminal/HostInfoPanel'
import TerminalTabs from '@/components/admin/terminal/TerminalTabs'
import { Button } from '@/components/ui/button'
import { PermissionProvider } from '@/contexts/PermissionContext'
import { useRequirePermission } from '@/hooks/useRequirePermission'
import { PERMISSIONS } from '@briar/shared'
import { AlertTriangle, Loader2, ShieldCheck, TerminalSquare } from 'lucide-react'
import { useState } from 'react'

const PAGE_PATH = '/briar/admin/terminal'

export default function AdminTerminalPage() {
	return (
		<PermissionProvider>
			<AdminTerminalPageInner />
		</PermissionProvider>
	)
}

function AdminTerminalPageInner() {
	const { loading: permLoading, denied } = useRequirePermission(PERMISSIONS.ADMIN_TERMINAL_ACCESS)
	// 设备授权态：邮箱验证码换取的 7 天设备令牌（本机 localStorage）
	const [authorized, setAuthorized] = useState(() => isDeviceAuthorized())
	const [deviceExpiry, setDeviceExpiry] = useState<Date | null>(() => getDeviceTokenExpiry())

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

	if (!authorized) {
		return (
			<AdminLayout currentPath={PAGE_PATH}>
				<DeviceGate
					onVerified={(token) => {
						saveDeviceToken(token)
						setDeviceExpiry(getDeviceTokenExpiry())
						setAuthorized(true)
					}}
				/>
			</AdminLayout>
		)
	}

	return (
		<AdminLayout currentPath={PAGE_PATH} fullWidth>
			<div className="space-y-4">
				<section className="flex flex-col gap-4 border-b border-border/60 pb-4 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex items-center gap-3">
						<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control border border-primary/20 bg-primary/5 text-primary">
							<TerminalSquare className="h-5 w-5" aria-hidden />
						</div>
						<div>
							<h1 className="text-lg font-semibold tracking-tight">SSH 控制台</h1>
							<p className="mt-1 text-xs leading-5 text-muted-foreground">
								多会话并行管理部署服务器；操作全程审计，30 分钟无输入自动断开。
							</p>
						</div>
					</div>
					<div className="flex flex-none items-center gap-3 rounded-control border border-success/20 bg-success/5 px-3 py-2">
						<ShieldCheck className="h-4 w-4 shrink-0 text-success" aria-hidden />
						<div>
							<p className="text-xs font-medium">设备已授权</p>
							{deviceExpiry && (
								<p className="mt-0.5 text-[11px] text-muted-foreground">
									有效期至 {deviceExpiry.toLocaleDateString()}
								</p>
							)}
						</div>
						<Button
							variant="default"
							size="sm"
							className="ml-2 h-7 px-2.5 text-xs"
							onClick={() => {
								clearDeviceToken()
								setAuthorized(false)
							}}
						>
							重新验证
						</Button>
					</div>
				</section>
				<HostInfoPanel />
				<TerminalTabs />
			</div>
		</AdminLayout>
	)
}
