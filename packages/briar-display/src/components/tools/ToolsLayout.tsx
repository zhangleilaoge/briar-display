'use client'

import { useSectionRouter } from '@/components/common/SectionRouter'
import { PageHeader } from '@/components/ui/page-header'
import { PaperPanel, ThemeShell } from '@/components/ui/theme-shell'
import { TOOLS_SECTION } from '@/config/site-routes'
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

const NAV_ICONS: Record<string, ReactNode> = {
	'/briar/tools/diff': <FileDiff className="h-4 w-4" />,
	'/briar/tools/compress': <ImageIcon className="h-4 w-4" />,
	'/briar/tools/json': <Braces className="h-4 w-4" />,
	'/briar/tools/media': <Clapperboard className="h-4 w-4" />,
	'/briar/tools/magnet': <Magnet className="h-4 w-4" />,
	'/briar/tools/regex': <Spline className="h-4 w-4" />,
	'/briar/tools/pdf': <FileLock2 className="h-4 w-4" />,
	'/briar/tools/section': <SquareStack className="h-4 w-4" />,
}

/** 顶栏 tab：文案与路径来自 config/site-routes */
export const TOOLS_NAV_ITEMS: NavItem[] = TOOLS_SECTION.children.map((sub) => ({
	label: sub.label,
	href: sub.path,
	icon: NAV_ICONS[sub.path],
}))

export const TOOLS_LAST_TAB_KEY = 'briar_tools_last_tab'

interface ToolsLayoutProps {
	children: ReactNode
	currentPath: string
}

/** 子页包装：在工具箱 SPA 壳内直通，单独渲染时（兜底）自带外壳 */
export default function ToolsLayout({ children, currentPath }: ToolsLayoutProps) {
	if (useSectionRouter()) return <>{children}</>
	return <ToolsShell currentPath={currentPath}>{children}</ToolsShell>
}

export function ToolsShell({ children, currentPath }: ToolsLayoutProps) {
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
				className="flex h-screen flex-col overflow-hidden"
			>
				<PageHeader
					crumbs={[{ label: '工具箱' }]}
					nav={TOOLS_NAV_ITEMS}
					currentPath={currentPath}
					inlineAt="2xl"
				/>

				{/* 内容区 */}
				<main className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 sm:p-6">
					<PaperPanel
						title="ATELIER · 工作台"
						autoHeight={false}
						className="flex flex-[1_0_auto] flex-col"
					>
						<div className="flex min-h-0 w-full flex-1 flex-col">{children}</div>
					</PaperPanel>
				</main>
			</ThemeShell>
		</PermissionProvider>
	)
}
