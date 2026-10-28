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
				glyph="钥"
				className="flex"
				accent={<AntiqueKey className="h-28 w-28 rotate-12" />}
			>
				{/* HUD 玻璃侧栏：1px 藏青线 + 选中项藏青反白 */}
				<aside className="glass-soft sticky top-0 hidden h-screen w-[220px] shrink-0 flex-col border-r border-[color:var(--rv-line)] p-4 md:flex">
					<HudTitle index="06" label="Clef" title="管理后台" className="mb-4 px-2" />
					<div className="mb-3 px-2 text-[11px] uppercase tracking-wider">
						<Breadcrumb>
							<BreadcrumbList>
								<BreadcrumbItem>
									<BreadcrumbLink href="/briar/">xiaobuzi</BreadcrumbLink>
								</BreadcrumbItem>
								<BreadcrumbSeparator />
								<BreadcrumbItem>
									<BreadcrumbPage>管理后台</BreadcrumbPage>
								</BreadcrumbItem>
							</BreadcrumbList>
						</Breadcrumb>
					</div>
					<nav className="space-y-0.5">
						{NAV_ITEMS.map((item) => {
							const isActive = currentPath === item.href
							return (
								<a key={item.href} href={item.href} className="block">
									<div
										className={cn(
											'flex items-center gap-2.5 rounded-control border px-2.5 py-2 font-control text-sm tracking-control transition-colors',
											isActive
												? 'border-transparent bg-[var(--row-selected)] font-medium text-[color:var(--row-selected-fg)] shadow-control'
												: 'border-transparent text-muted-foreground hover:border-[color:var(--rv-line)] hover:bg-[var(--row-hover)] hover:text-foreground',
										)}
									>
										{item.icon}
										{item.label}
									</div>
								</a>
							)
						})}
					</nav>
				</aside>

				{/* 内容区 */}
				<div className="flex min-w-0 flex-1 flex-col">
					{/* 顶栏 */}
					<header className="glass-header sticky top-0 z-30 flex h-12 items-center justify-between gap-3 px-4">
						<span className="font-heading text-sm font-semibold md:hidden">管理后台</span>
						<div className="hidden md:block" />
						<UserMenu />
					</header>

					{/* 窄屏：导航 tab 独占一行，横向滚动（同工具箱 ToolsLayout 模式） */}
					<div className="glass-soft overflow-x-auto border-b px-3 py-2 md:hidden">
						<Tabs
							value={currentPath}
							onValueChange={(v) => {
								window.location.href = v
							}}
						>
							<TabsList>
								{NAV_ITEMS.map((item) => (
									<TabsTrigger key={item.href} value={item.href} className="gap-1.5">
										{item.icon}
										{item.label}
									</TabsTrigger>
								))}
							</TabsList>
						</Tabs>
					</div>

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
