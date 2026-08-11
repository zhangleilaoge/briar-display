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
import { AlertTriangle, Loader2, ShieldCheck } from 'lucide-react'
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
			<div className="space-y-3">
				<div className="flex items-center justify-between">
					<p className="text-xs text-muted-foreground">
						通过 WebSocket 桥接 SSH 到部署服务器，支持多标签会话。所有操作会记录审计日志，30
						分钟无输入自动断开。
					</p>
					<div className="flex items-center gap-2 text-xs text-muted-foreground">
						<ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
						<span>设备已授权{deviceExpiry ? `至 ${deviceExpiry.toLocaleDateString()}` : ''}</span>
						<Button
							variant="ghost"
							size="sm"
							className="h-6 px-2 text-xs"
							onClick={() => {
								clearDeviceToken()
								setAuthorized(false)
							}}
						>
							重新验证
						</Button>
					</div>
				</div>
				<HostInfoPanel />
				<TerminalTabs />
			</div>
		</AdminLayout>
	)
}
