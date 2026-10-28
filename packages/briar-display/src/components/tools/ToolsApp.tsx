'use client'

import {
	SectionOutlet,
	type SectionRoute,
	SectionRouterProvider,
	useSectionPath,
} from '@/components/common/SectionRouter'
import { lazy } from 'react'
import { ToolsShell } from './ToolsLayout'

/** 工具箱子路由表：各工具按需懒加载（切面模拟器的 three/R3F、媒体解析等只在访问时下载） */
export const TOOL_ROUTES: SectionRoute[] = [
	{
		path: '/briar/tools/diff',
		title: '文件 Diff - 工具箱',
		component: lazy(() => import('./ToolDiffPage')),
	},
	{
		path: '/briar/tools/compress',
		title: '图片压缩 - 工具箱',
		component: lazy(() => import('./ToolCompressPage')),
	},
	{
		path: '/briar/tools/json',
		title: 'JSON 格式化 - 工具箱',
		component: lazy(() => import('./ToolJsonPage')),
	},
	{
		path: '/briar/tools/media',
		title: '媒体解析 - 工具箱',
		component: lazy(() => import('./ToolMediaPage')),
	},
	{
		path: '/briar/tools/magnet',
		title: '磁力查询 - 工具箱',
		component: lazy(() => import('./ToolMagnetPage')),
	},
	{
		path: '/briar/tools/regex',
		title: '正则可视化 - 工具箱',
		component: lazy(() => import('./ToolRegexPage')),
	},
	{
		path: '/briar/tools/pdf',
		title: 'PDF 解除限制 - 工具箱',
		component: lazy(() => import('./ToolPdfUnlockPage')),
	},
	{
		path: '/briar/tools/section',
		title: '切面模拟器 - 工具箱',
		component: lazy(() => import('./ToolSectionPage')),
	},
]

const Fallback = () => <div className="min-h-[50vh] w-full animate-pulse rounded-md bg-muted/40" />

export default function ToolsApp({ initialPath }: { initialPath: string }) {
	const { path, route, navigate } = useSectionPath(initialPath, TOOL_ROUTES)
	return (
		<SectionRouterProvider path={path} navigate={navigate}>
			<ToolsShell currentPath={path}>
				<SectionOutlet route={route} fallback={<Fallback />} />
			</ToolsShell>
		</SectionRouterProvider>
	)
}
