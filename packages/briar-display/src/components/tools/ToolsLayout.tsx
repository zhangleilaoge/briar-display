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
import { Braces, Clapperboard, FileDiff, ImageIcon, Spline } from 'lucide-react'
import { type ReactNode, useEffect } from 'react'

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
	{
		label: '媒体解析',
		href: '/briar/tools/media',
		icon: <Clapperboard className="h-4 w-4" />,
	},
	{
		label: '正则可视化',
		href: '/briar/tools/regex',
		icon: <Spline className="h-4 w-4" />,
	},
]

export const TOOLS_LAST_TAB_KEY = 'briar_tools_last_tab'

interface ToolsLayoutProps {
	children: ReactNode
	currentPath: string
}

export default function ToolsLayout({ children, currentPath }: ToolsLayoutProps) {
	// 记住当前 tab，下次从首页进入工具箱时恢复
	useEffect(() => {
		localStorage.setItem(TOOLS_LAST_TAB_KEY, currentPath)
	}, [currentPath])

	const tabs = (
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
	)

	return (
		<PermissionProvider>
			{/* 云系浅蓝渐变底（与首页 shader 色阶同源的静态版本，工作页不用 WebGL） */}
			<div className="cloud-scope flex h-screen flex-col overflow-hidden bg-gradient-to-b from-[#e7f0f8] via-[#f0f5fa] to-[#e9f1f8]">
				{/* 顶部导航栏 */}
				<header className="glass-header sticky top-0 z-50">
					<div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
						<div className="flex items-center gap-6">
							<Breadcrumb>
								<BreadcrumbList>
									<BreadcrumbItem>
										<BreadcrumbLink href="/briar/">xiaobuzi</BreadcrumbLink>
									</BreadcrumbItem>
									<BreadcrumbSeparator />
									<BreadcrumbItem>
										<BreadcrumbPage>工具箱</BreadcrumbPage>
									</BreadcrumbItem>
								</BreadcrumbList>
							</Breadcrumb>
							{/* 宽屏：tab 与面包屑同行 */}
							<div className="hidden lg:block">{tabs}</div>
						</div>
						<UserMenu />
					</div>
					{/* 窄屏：tab 独占一行，横向滚动 */}
					<div className="overflow-x-auto px-3 pb-2 lg:hidden">{tabs}</div>
				</header>

				{/* 内容区 */}
				<main className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 sm:p-6">
					<div className="flex w-full flex-1 flex-col min-h-0">{children}</div>
				</main>
			</div>
		</PermissionProvider>
	)
}
