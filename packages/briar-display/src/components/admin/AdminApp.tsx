'use client'

import {
	SectionOutlet,
	type SectionRoute,
	SectionRouterProvider,
	useSectionPath,
} from '@/components/common/SectionRouter'
import { ADMIN_SECTION, sectionTitle } from '@/config/site-routes'
import { lazy } from 'react'
import { AdminShell } from './AdminLayout'

/** 管理后台子路由表：各页按需懒加载（SSH 控制台的 xterm 等只在访问时下载） */
/** 子页组件（按需懒加载）；路径/标题来自 config/site-routes，避免与首页搜索、顶栏 tab 不同步 */
const COMPONENTS: Record<string, SectionRoute['component']> = {
	'/briar/admin/permissions': lazy(() => import('./AdminPermissionsPage')),
	'/briar/admin/users': lazy(() => import('./AdminUsersPage')),
	'/briar/admin/logs': lazy(() => import('./AdminLogsPage')),
	'/briar/admin/sql': lazy(() => import('./AdminSqlConsole')),
	'/briar/admin/deploy': lazy(() => import('./AdminDeployPage')),
	'/briar/admin/terminal': lazy(() => import('./AdminTerminalPage')),
}

export const ADMIN_ROUTES: SectionRoute[] = ADMIN_SECTION.children.map((sub) => ({
	path: sub.path,
	title: sectionTitle(ADMIN_SECTION, sub),
	component: COMPONENTS[sub.path],
	fullWidth: sub.path === '/briar/admin/terminal',
}))

const Fallback = () => <div className="min-h-[40vh] w-full animate-pulse rounded-md bg-muted/40" />

export default function AdminApp({ initialPath }: { initialPath: string }) {
	const { path, route, navigate } = useSectionPath(initialPath, ADMIN_ROUTES)
	return (
		<SectionRouterProvider path={path} navigate={navigate}>
			<AdminShell currentPath={path} fullWidth={route?.fullWidth}>
				<SectionOutlet route={route} fallback={<Fallback />} />
			</AdminShell>
		</SectionRouterProvider>
	)
}
