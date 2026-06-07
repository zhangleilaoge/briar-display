'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Shield, Users } from 'lucide-react'
import type { ReactNode } from 'react'

interface NavItem {
	label: string
	href: string
	icon: React.ReactNode
}

const NAV_ITEMS: NavItem[] = [
	{
		label: '权限管理',
		href: '/briar-display/admin/permissions',
		icon: <Shield className="h-4 w-4" />,
	},
	{
		label: '用户角色',
		href: '/briar-display/admin/users',
		icon: <Users className="h-4 w-4" />,
	},
]

interface AdminLayoutProps {
	children: ReactNode
	currentPath: string
}

export default function AdminLayout({ children, currentPath }: AdminLayoutProps) {
	return (
		<div className="flex min-h-screen">
			{/* 深色侧栏 */}
			<aside className="hidden w-[220px] shrink-0 flex-col bg-foreground p-4 md:flex">
				<a
					href="/briar-display/"
					className="mb-8 text-sm font-semibold tracking-tight text-background/90 hover:text-background"
				>
					← Briar 门户
				</a>
				<p className="mb-3 px-2 text-[11px] font-medium uppercase tracking-wider text-background/40">
					管理后台
				</p>
				<nav className="space-y-0.5">
					{NAV_ITEMS.map((item) => {
						const isActive = currentPath === item.href
						return (
							<a key={item.href} href={item.href} className="block">
								<div
									className={cn(
										'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors',
										isActive
											? 'bg-background/15 font-medium text-background'
											: 'text-background/60 hover:bg-background/10 hover:text-background/90',
									)}
								>
									{item.icon}
									{item.label}
								</div>
							</a>
						)
					})}
				</nav>
				<div className="mt-auto">
					<a
						href="/briar-display/wiki/"
						className="block rounded-md px-2.5 py-2 text-sm text-background/40 transition-colors hover:bg-background/10 hover:text-background/70"
					>
						返回 Wiki →
					</a>
				</div>
			</aside>

			{/* 内容区 */}
			<div className="flex min-w-0 flex-1 flex-col">
				{/* 移动端顶栏 */}
				<header className="flex h-12 items-center gap-3 border-b px-4 md:hidden">
					<a href="/briar-display/" className="text-sm font-semibold">
						← 返回
					</a>
					<span className="text-sm text-muted-foreground">管理后台</span>
				</header>

				<main className="flex-1 bg-muted/30 p-6">
					<div className="mx-auto max-w-[1200px]">{children}</div>
				</main>
			</div>
		</div>
	)
}
