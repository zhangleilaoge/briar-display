'use client'

import type { SectionRoute } from '@/components/common/SectionRouter'
import { TOOLS_SECTION, sectionTitle } from '@/config/site-routes'
import { lazy } from 'react'

/** 路径与标题来自 config/site-routes；较重的工具只在实际访问时下载。 */
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
