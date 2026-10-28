'use client'

import {
	SectionOutlet,
	type SectionRoute,
	SectionRouterProvider,
	useSectionPath,
} from '@/components/common/SectionRouter'
import { TOOLS_SECTION, sectionTitle } from '@/config/site-routes'
import { lazy } from 'react'
import { ToolsShell } from './ToolsLayout'

/** 工具箱子路由表：各工具按需懒加载（切面模拟器的 three/R3F、媒体解析等只在访问时下载） */
/** 子页组件（按需懒加载）；路径/标题来自 config/site-routes，避免与首页搜索、顶栏 tab 不同步 */
const COMPONENTS: Record<string, SectionRoute['component']> = {
	'/briar/tools/diff': lazy(() => import('./ToolDiffPage')),
	'/briar/tools/compress': lazy(() => import('./ToolCompressPage')),
	'/briar/tools/json': lazy(() => import('./ToolJsonPage')),
	'/briar/tools/media': lazy(() => import('./ToolMediaPage')),
	'/briar/tools/magnet': lazy(() => import('./ToolMagnetPage')),
	'/briar/tools/regex': lazy(() => import('./ToolRegexPage')),
	'/briar/tools/pdf': lazy(() => import('./ToolPdfUnlockPage')),
	'/briar/tools/section': lazy(() => import('./ToolSectionPage')),
}

export const TOOL_ROUTES: SectionRoute[] = TOOLS_SECTION.children.map((sub) => ({
	path: sub.path,
	title: sectionTitle(TOOLS_SECTION, sub),
	component: COMPONENTS[sub.path],
}))

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
