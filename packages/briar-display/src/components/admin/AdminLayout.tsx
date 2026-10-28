'use client'

import UserMenu from '@/components/common/UserMenu'
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { AntiqueKey } from '@/components/ui/ornaments'
import { PageHeader } from '@/components/ui/page-header'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { HudTitle, PaperPanel, ThemeShell } from '@/components/ui/theme-shell'
import { PermissionProvider } from '@/contexts/PermissionContext'
import { cn } from '@/lib/utils'
import { Database, Radio, Rocket, Shield, TerminalSquare, Users } from 'lucide-react'
import { type ReactNode, useEffect } from 'react'

interface NavItem {
	label: string
	href: string
	icon: React.ReactNode
}

const NAV_ITEMS: NavItem[] = [
	{
		label: '权限管理',
		href: '/briar/admin/permissions',
		icon: <Shield className="h-4 w-4" />,
	},
	{
		label: '用户角色',
		href: '/briar/admin/users',
		icon: <Users className="h-4 w-4" />,
	},
	{
		label: '天网日志',
		href: '/briar/admin/logs',
		icon: <Radio className="h-4 w-4" />,
	},
	{
		label: 'SQL 控制台',
		href: '/briar/admin/sql',
		icon: <Database className="h-4 w-4" />,
	},
	{
		label: '应用部署',
		href: '/briar/admin/deploy',
		icon: <Rocket className="h-4 w-4" />,
	},
	{
		label: 'SSH 控制台',
		href: '/briar/admin/terminal',
		icon: <TerminalSquare className="h-4 w-4" />,
	},
]

export const ADMIN_LAST_TAB_KEY = 'briar_admin_last_tab'

interface AdminLayoutProps {
	children: ReactNode
	currentPath: string
	/** 内容区占满可用宽度（默认限宽 1200px 居中） */
	fullWidth?: boolean
}

export default function AdminLayout({ children, currentPath, fullWidth }: AdminLayoutProps) {
	// 记住当前 tab，下次进入管理后台时恢复（同工具箱 TOOLS_LAST_TAB_KEY 模式）
	useEffect(() => {
		localStorage.setItem(ADMIN_LAST_TAB_KEY, currentPath)
	}, [currentPath])

	return (
		<PermissionProvider>
			<ThemeShell
				variant="arcane"
				watermark="06"
				className="flex flex-col"
				accent={<AntiqueKey className="h-28 w-28 rotate-12" />}
			>
				<div className="flex min-w-0 flex-1 flex-col">
					<PageHeader
						crumbs={[{ label: '管理后台' }]}
						nav={NAV_ITEMS}
						currentPath={currentPath}
						inlineAt="xl"
					/>

					<main className="flex-1 p-4 sm:p-6">
						<div className={fullWidth ? 'w-full' : 'mx-auto w-full max-w-[1200px]'}>
							<PaperPanel index="06" title="CLEF · 机要室">
								{children}
							</PaperPanel>
						</div>
					</main>
				</div>
			</ThemeShell>
		</PermissionProvider>
	)
}
