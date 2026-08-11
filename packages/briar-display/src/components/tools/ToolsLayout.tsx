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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PermissionProvider } from '@/contexts/PermissionContext'
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
		href: '/briar/tools/diff',
		icon: <FileDiff className="h-4 w-4" />,
	},
	{
		label: '图片压缩',
		href: '/briar/tools/compress',
		icon: <ImageIcon className="h-4 w-4" />,
	},
	{
		label: 'JSON 格式化',
		href: '/briar/tools/json',
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
			<div className="flex h-screen flex-col overflow-hidden bg-background">
				{/* 顶部导航栏 */}
				<header className="sticky top-0 z-50 border-b bg-background">
					<div className="flex h-14 items-center justify-between px-6">
						<div className="flex items-center gap-6">
							<Breadcrumb>
								<BreadcrumbList>
									<BreadcrumbItem>
										<BreadcrumbLink href="/briar/">Briar</BreadcrumbLink>
									</BreadcrumbItem>
									<BreadcrumbSeparator />
									<BreadcrumbItem>
										<BreadcrumbPage>工具箱</BreadcrumbPage>
									</BreadcrumbItem>
								</BreadcrumbList>
							</Breadcrumb>
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
						<UserMenu variant="light" />
					</div>
				</header>

				{/* 内容区 */}
				<main className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6">
					<div className="flex w-full flex-1 flex-col min-h-0">{children}</div>
				</main>
			</div>
		</PermissionProvider>
	)
}
