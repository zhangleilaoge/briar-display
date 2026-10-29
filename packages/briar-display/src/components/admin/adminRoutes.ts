'use client'

import type { SectionRoute } from '@/components/common/SectionRouter'
import { ADMIN_SECTION, sectionTitle } from '@/config/site-routes'
import { lazy } from 'react'

/** 路径与标题来自 config/site-routes；SSH 等较重的页面按需下载。 */
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
