'use client'

import {
	SectionOutlet,
	type SectionRoute,
	SectionRouterProvider,
	useSectionPath,
} from '@/components/common/SectionRouter'
import { lazy } from 'react'
import { AdminShell } from './AdminLayout'

/** 管理后台子路由表：各页按需懒加载（SSH 控制台的 xterm 等只在访问时下载） */
export const ADMIN_ROUTES: SectionRoute[] = [
	{
		path: '/briar/admin/permissions',
		title: '权限管理 - 管理后台',
		component: lazy(() => import('./AdminPermissionsPage')),
	},
	{
		path: '/briar/admin/users',
		title: '用户角色 - 管理后台',
		component: lazy(() => import('./AdminUsersPage')),
	},
	{
		path: '/briar/admin/logs',
		title: '天网日志 - 管理后台',
		component: lazy(() => import('./AdminLogsPage')),
	},
	{
		path: '/briar/admin/sql',
		title: 'SQL 控制台 - 管理后台',
		component: lazy(() => import('./AdminSqlConsole')),
	},
	{
		path: '/briar/admin/deploy',
		title: '应用部署 - 管理后台',
		component: lazy(() => import('./AdminDeployPage')),
	},
	{
		path: '/briar/admin/terminal',
		title: 'SSH 控制台 - 管理后台',
		component: lazy(() => import('./AdminTerminalPage')),
		fullWidth: true,
	},
]

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
