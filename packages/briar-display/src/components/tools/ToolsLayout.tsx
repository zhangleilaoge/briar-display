'use client'

import UserMenu from '@/components/common/UserMenu'
import { Button } from '@/components/ui/button'
import { PermissionProvider } from '@/contexts/PermissionContext'
import { cn } from '@/lib/utils'
import { Braces, FileDiff, ImageIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface NavItem {
	label: string
	href: string
	icon: React.ReactNode
}

const NAV_ITEMS: NavItem[] = [
	{
		label: '文件 Diff',
		href: '/briar-display/tools/diff',
		icon: <FileDiff className="h-4 w-4" />,
	},
	{
		label: '图片压缩',
		href: '/briar-display/tools/compress',
		icon: <ImageIcon className="h-4 w-4" />,
	},
	{
		label: 'JSON 格式化',
		href: '/briar-display/tools/json',
		icon: <Braces className="h-4 w-4" />,
	},
]

interface ToolsLayoutProps {
	children: ReactNode
	currentPath: string
}

export default function ToolsLayout({ children, currentPath }: ToolsLayoutProps) {
	return (
		<PermissionProvider>
			<div className="flex min-h-screen flex-col bg-background">
				{/* 顶部导航栏 */}
				<header className="sticky top-0 z-50 border-b bg-background">
					<div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-6">
						<div className="flex items-center gap-6">
							<a
								href="/briar-display/"
								className="text-sm font-semibold text-foreground no-underline"
							>
								Briar
							</a>
							<span className="text-sm text-muted-foreground">/ 工具箱</span>
							<nav className="flex items-center gap-1">
								{NAV_ITEMS.map((item) => {
									const isActive = currentPath === item.href
									return (
										<a key={item.href} href={item.href}>
											<Button
												variant="ghost"
												size="sm"
												className={cn('gap-1.5', isActive && 'bg-accent font-medium')}
											>
												{item.icon}
												{item.label}
											</Button>
										</a>
									)
								})}
							</nav>
						</div>
						<UserMenu variant="light" />
					</div>
				</header>

				{/* 内容区 */}
				<main className="flex-1 p-6">
					<div className="mx-auto max-w-[1200px]">{children}</div>
				</main>
			</div>
		</PermissionProvider>
	)
}
