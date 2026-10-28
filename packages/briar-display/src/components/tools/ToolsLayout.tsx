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
import { ScissorsCut } from '@/components/ui/ornaments'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { HudTitle, PaperPanel, ThemeShell } from '@/components/ui/theme-shell'
import { PermissionProvider } from '@/contexts/PermissionContext'
import {
	Braces,
	Clapperboard,
	FileDiff,
	FileLock2,
	ImageIcon,
	Magnet,
	Spline,
	SquareStack,
} from 'lucide-react'
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
		label: '磁力查询',
		href: '/briar/tools/magnet',
		icon: <Magnet className="h-4 w-4" />,
	},
	{
		label: '正则可视化',
		href: '/briar/tools/regex',
		icon: <Spline className="h-4 w-4" />,
	},
	{
		label: 'PDF 解除限制',
		href: '/briar/tools/pdf',
		icon: <FileLock2 className="h-4 w-4" />,
	},
	{
		label: '切面模拟器',
		href: '/briar/tools/section',
		icon: <SquareStack className="h-4 w-4" />,
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
			{/* Arcane HUD 外壳：冰蓝玻璃底 + 星盘/希腊柱装饰 + 全局吊牌侧栏 */}
			<ThemeShell
				variant="arcane"
				currentPath={currentPath}
				watermark="02"
				glyph="工"
				className="flex h-screen flex-col overflow-hidden"
				accent={<ScissorsCut className="h-28 w-auto -rotate-12" />}
			>
				{/* 顶部导航栏 */}
				<header className="glass-header sticky top-0 z-50">
					<div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
						<div className="flex items-center gap-6">
							<HudTitle
								index="02"
								label="Outils"
								title="工具箱"
								script="Atelier"
								className="hidden shrink-0 2xl:flex"
							/>
							<Breadcrumb className="shrink-0 whitespace-nowrap">
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
						<div className="shrink-0">
							<UserMenu />
						</div>
					</div>
					{/* 窄屏：tab 独占一行，横向滚动 */}
					<div className="overflow-x-auto px-3 pb-2 lg:hidden">{tabs}</div>
				</header>

				{/* 内容区 */}
				<main className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 sm:p-6">
					<PaperPanel index="02" title="ATELIER · 工作台" className="flex min-h-0 flex-1 flex-col">
						<div className="flex min-h-0 w-full flex-1 flex-col">{children}</div>
					</PaperPanel>
				</main>
			</ThemeShell>
		</PermissionProvider>
	)
}
