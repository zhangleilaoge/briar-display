'use client'

import { ADMIN_LAST_TAB_KEY, AdminShell } from '@/components/admin/AdminLayout'
import { ADMIN_ROUTES } from '@/components/admin/adminRoutes'
import {
	SectionOutlet,
	type SectionRoute,
	SectionRouterProvider,
	useSectionPath,
} from '@/components/common/SectionRouter'
import { TOOLS_LAST_TAB_KEY, ToolsShell } from '@/components/tools/ToolsLayout'
import { TOOL_ROUTES } from '@/components/tools/toolRoutes'
import { RibbonSidebar } from '@/components/ui/ribbon-sidebar'
import { MARKETS_SECTION, sectionTitle } from '@/config/site-routes'
import { PermissionProvider } from '@/contexts/PermissionContext'
import { themeClass, themeForPath } from '@/lib/theme'
import type { MarketId } from '@briar/shared'
import { lazy, useEffect } from 'react'

interface SiteRoute extends SectionRoute {
	section?: 'tools' | 'admin'
}

function restoreLastRoute(key: string, routes: SectionRoute[], fallback: string) {
	try {
		const last = localStorage.getItem(key)
		if (last && routes.some((route) => route.path === last)) return last
	} catch {
		// 存储不可用时使用默认子页。
	}
	return fallback
}

const MARKET_ROUTES: SiteRoute[] = MARKETS_SECTION.children.map((sub) => {
	const market = sub.path.slice('/briar/markets/'.length) as MarketId
	return {
		path: sub.path,
		title: sectionTitle(MARKETS_SECTION, sub),
		component: lazy(async () => {
			const { default: MarketSectorsPage } = await import('../markets/MarketSectorsPage')
			return { default: () => <MarketSectorsPage market={market} /> }
		}),
	}
})

export const SITE_ROUTES: SiteRoute[] = [
	{ path: '/briar', title: 'xiaobuzi', component: lazy(() => import('../pages/PortalPage')) },
	{
		path: '/briar/style',
		title: '风格 · xiaobuzi',
		component: lazy(() => import('../style/StylePage')),
	},
	{
		path: '/briar/tools',
		title: '工具箱',
		section: 'tools',
		redirect: () => restoreLastRoute(TOOLS_LAST_TAB_KEY, TOOL_ROUTES, TOOL_ROUTES[0].path),
	},
	...TOOL_ROUTES.map((route) => ({ ...route, section: 'tools' as const })),
	{
		path: '/briar/files',
		title: '文件',
		component: lazy(() => import('../files/FileManagerPage')),
	},
	{
		path: '/briar/thoughts',
		title: '想法 - xiaobuzi',
		component: lazy(() => import('../pages/ThoughtsPage')),
	},
	{
		path: '/briar/markets',
		title: '行情',
		component: lazy(() => import('../markets/MarketsOverviewPage')),
	},
	...MARKET_ROUTES,
	{
		path: '/briar/admin',
		title: '管理后台',
		section: 'admin',
		redirect: () => restoreLastRoute(ADMIN_LAST_TAB_KEY, ADMIN_ROUTES, ADMIN_ROUTES[0].path),
	},
	...ADMIN_ROUTES.map((route) => ({ ...route, section: 'admin' as const })),
	{
		path: '/briar/profile',
		title: '个人中心 - xiaobuzi',
		component: lazy(() => import('../pages/ProfilePage')),
	},
]

const Fallback = () => <div className="min-h-[50vh] w-full animate-pulse rounded-md bg-muted/40" />

export default function SiteApp({ initialPath }: { initialPath: string }) {
	const { path, route, navigate } = useSectionPath(initialPath, SITE_ROUTES)

	useEffect(() => {
		document.body.classList.remove('theme-scrapbook', 'theme-arcane')
		document.body.classList.add(themeClass(themeForPath(path)))
	}, [path])

	let outlet = <SectionOutlet route={route} fallback={<Fallback />} />
	if (route?.section === 'tools' && route.component) {
		outlet = <ToolsShell currentPath={path}>{outlet}</ToolsShell>
	} else if (route?.section === 'admin' && route.component) {
		outlet = (
			<AdminShell currentPath={path} fullWidth={route.fullWidth}>
				{outlet}
			</AdminShell>
		)
	}

	return (
		<PermissionProvider>
			<SectionRouterProvider path={path} navigate={navigate} globalShell>
				<RibbonSidebar currentPath={path} />
				{outlet}
			</SectionRouterProvider>
		</PermissionProvider>
	)
}
