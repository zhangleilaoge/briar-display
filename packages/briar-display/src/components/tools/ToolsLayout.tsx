'use client'

import { ScissorsCut } from '@/components/ui/ornaments'
import { PageHeader } from '@/components/ui/page-header'
import { PaperPanel, ThemeShell } from '@/components/ui/theme-shell'
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

	return (
		<PermissionProvider>
			{/* Arcane HUD 外壳：冰蓝玻璃底 + 星盘/希腊柱装饰 + 全局吊牌侧栏 */}
			<ThemeShell
				variant="arcane"
				currentPath={currentPath}
				watermark="02"
				className="flex h-screen flex-col overflow-hidden"
				accent={<ScissorsCut className="h-28 w-auto -rotate-12" />}
			>
				<PageHeader
					crumbs={[{ label: '工具箱' }]}
					nav={NAV_ITEMS}
					currentPath={currentPath}
					inlineAt="2xl"
				/>

				{/* 内容区 */}
				<main className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 sm:p-6">
					<PaperPanel index="02" title="ATELIER · 工作台" className="flex flex-[1_0_auto] flex-col">
						<div className="flex min-h-0 w-full flex-1 flex-col">{children}</div>
					</PaperPanel>
				</main>
			</ThemeShell>
		</PermissionProvider>
	)
}
