'use client'

import { useSectionRouter } from '@/components/common/SectionRouter'
import UserMenu from '@/components/common/UserMenu'
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { PageHeader } from '@/components/ui/page-header'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PaperPanel, ThemeShell } from '@/components/ui/theme-shell'
import { ADMIN_SECTION } from '@/config/site-routes'
import { PermissionProvider } from '@/contexts/PermissionContext'
import { cn } from '@/lib/utils'
import { Database, Radio, Rocket, Shield, TerminalSquare, Users } from 'lucide-react'
import { type ReactNode, useEffect } from 'react'

interface NavItem {
	label: string
	href: string
	icon: React.ReactNode
}

const NAV_ICONS: Record<string, ReactNode> = {
	'/briar/admin/permissions': <Shield className="h-4 w-4" />,
	'/briar/admin/users': <Users className="h-4 w-4" />,
	'/briar/admin/logs': <Radio className="h-4 w-4" />,
	'/briar/admin/sql': <Database className="h-4 w-4" />,
	'/briar/admin/deploy': <Rocket className="h-4 w-4" />,
	'/briar/admin/terminal': <TerminalSquare className="h-4 w-4" />,
}

/** 顶栏 tab：文案与路径来自 config/site-routes */
export const ADMIN_NAV_ITEMS: NavItem[] = ADMIN_SECTION.children.map((sub) => ({
	label: sub.label,
	href: sub.path,
	icon: NAV_ICONS[sub.path],
}))

export const ADMIN_LAST_TAB_KEY = 'briar_admin_last_tab'

interface AdminLayoutProps {
	children: ReactNode
	currentPath: string
	/** 内容区占满可用宽度（默认限宽 1200px 居中） */
	fullWidth?: boolean
}

/** 子页包装：在管理后台 SPA 壳内直通，单独渲染时（兜底）自带外壳 */
export default function AdminLayout(props: AdminLayoutProps) {
	if (useSectionRouter()) return <>{props.children}</>
	return <AdminShell {...props} />
}

export function AdminShell({ children, currentPath, fullWidth }: AdminLayoutProps) {
	// 记住当前 tab，下次进入管理后台时恢复（同工具箱 TOOLS_LAST_TAB_KEY 模式）
	useEffect(() => {
		localStorage.setItem(ADMIN_LAST_TAB_KEY, currentPath)
	}, [currentPath])

	return (
		<PermissionProvider>
			<ThemeShell variant="arcane" className="flex flex-col">
				<div className="flex min-w-0 flex-1 flex-col">
					<PageHeader
						crumbs={[{ label: '管理后台' }]}
						nav={ADMIN_NAV_ITEMS}
						currentPath={currentPath}
						inlineAt="xl"
					/>

					<main className="flex-1 p-4 sm:p-6">
						<div className={fullWidth ? 'w-full' : 'mx-auto w-full max-w-[1200px]'}>
							<PaperPanel title="CLEF · 机要室">{children}</PaperPanel>
						</div>
					</main>
				</div>
			</ThemeShell>
		</PermissionProvider>
	)
}
