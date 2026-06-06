'use client'

import { usePermissions } from '@/contexts/PermissionContext'
import { cn } from '@/lib/utils'
import { PERMISSIONS } from '@briar/shared'
import {
	BarChart3,
	Eye,
	FileText,
	History,
	Home,
	LayoutList,
	Link2,
	Settings,
	Shield,
	Star,
	Tag,
	TrendingUp,
} from 'lucide-react'
import { useEffect, useState } from 'react'

interface SidebarLink {
	label: string
	href: string
	icon?: React.ReactNode
	requirePermission?: string
}

interface SidebarSection {
	title: string
	links: SidebarLink[]
	requireAuth?: boolean
	requirePermission?: string
}

const sections: SidebarSection[] = [
	{
		title: '导航',
		links: [
			{ label: '首页', href: '/briar-display/wiki/', icon: <Home className="h-3.5 w-3.5" /> },
			{
				label: '最近更改',
				href: '/briar-display/wiki/special/recent-changes',
				icon: <TrendingUp className="h-3.5 w-3.5" />,
			},
			{
				label: '所有页面',
				href: '/briar-display/wiki/special/all-pages',
				icon: <FileText className="h-3.5 w-3.5" />,
			},
			{
				label: '分类',
				href: '/briar-display/wiki/category/',
				icon: <LayoutList className="h-3.5 w-3.5" />,
			},
			{
				label: '标签',
				href: '/briar-display/wiki/special/tags',
				icon: <Tag className="h-3.5 w-3.5" />,
			},
		],
	},
	{
		title: '交互',
		requireAuth: true,
		links: [
			{
				label: '关注列表',
				href: '/briar-display/wiki/special/watchlist',
				icon: <Eye className="h-3.5 w-3.5" />,
			},
			{
				label: '我的收藏',
				href: '/briar-display/wiki/special/stars',
				icon: <Star className="h-3.5 w-3.5" />,
			},
			{
				label: '我的贡献',
				href: '/briar-display/wiki/special/user-contributions',
				icon: <History className="h-3.5 w-3.5" />,
			},
		],
	},
	{
		title: '工具',
		links: [
			{
				label: '孤立页面',
				href: '/briar-display/wiki/special/orphaned-pages',
				icon: <Link2 className="h-3.5 w-3.5" />,
			},
			{
				label: '期望页面',
				href: '/briar-display/wiki/special/wanted-pages',
				icon: <FileText className="h-3.5 w-3.5" />,
			},
			{
				label: '模板',
				href: '/briar-display/wiki/special/templates',
				icon: <LayoutList className="h-3.5 w-3.5" />,
			},
			{
				label: '统计',
				href: '/briar-display/wiki/special/statistics',
				icon: <BarChart3 className="h-3.5 w-3.5" />,
			},
		],
	},
	{
		title: '管理',
		requireAuth: true,
		requirePermission: PERMISSIONS.PAGE_ADMIN,
		links: [
			{
				label: '权限管理',
				href: '/briar-display/wiki/special/admin/permissions',
				icon: <Shield className="h-3.5 w-3.5" />,
				requirePermission: PERMISSIONS.ADMIN_ROLE_MANAGE,
			},
			{
				label: '用户角色',
				href: '/briar-display/wiki/special/admin/users',
				icon: <Settings className="h-3.5 w-3.5" />,
				requirePermission: PERMISSIONS.ADMIN_USER_ROLE_ASSIGN,
			},
		],
	},
]

function isActiveLink(href: string, pathname: string): boolean {
	// Normalize: strip trailing slash for comparison (except root)
	const normalize = (s: string) => s.replace(/\/+$/, '') || '/'
	const normHref = normalize(href)
	const normPath = normalize(pathname)

	// Exact match
	if (normPath === normHref) return true

	// Root wiki is active only on exact match
	if (normHref === '/briar-display/wiki') return normPath === '/briar-display/wiki'

	// For non-root links, check if path starts with href
	return normPath.startsWith(`${normHref}/`)
}

export default function WikiSidebar() {
	const [pathname, setPathname] = useState('')
	const { isLoggedIn, hasPermission, hasAnyPermission } = usePermissions()

	useEffect(() => {
		setPathname(window.location.pathname)

		const handlePop = () => setPathname(window.location.pathname)
		window.addEventListener('popstate', handlePop)

		const origPushState = history.pushState.bind(history)
		history.pushState = (...args: Parameters<typeof history.pushState>) => {
			origPushState(...args)
			setPathname(window.location.pathname)
		}
		const origReplaceState = history.replaceState.bind(history)
		history.replaceState = (...args: Parameters<typeof history.replaceState>) => {
			origReplaceState(...args)
			setPathname(window.location.pathname)
		}

		return () => {
			window.removeEventListener('popstate', handlePop)
			history.pushState = origPushState
			history.replaceState = origReplaceState
		}
	}, [])

	return (
		<nav className="py-3 text-[13px]">
			{sections.map((section) => {
				if (section.requireAuth && !isLoggedIn) return null
				if (section.requirePermission && !hasPermission(section.requirePermission)) return null

				// 过滤没有权限的链接
				const visibleLinks = section.links.filter(
					(link) => !link.requirePermission || hasPermission(link.requirePermission),
				)
				if (visibleLinks.length === 0) return null

				return (
					<div key={section.title}>
						<h3 className="px-3 pb-1 pt-4 text-[11px] font-medium uppercase tracking-wider text-wiki-text-muted first:pt-2">
							{section.title}
						</h3>
						<ul>
							{visibleLinks.map((link) => {
								const active = isActiveLink(link.href, pathname)
								return (
									<li key={link.href}>
										<a
											href={link.href}
											className={cn(
												'flex items-center gap-2 rounded-r px-3 py-1.5 transition-colors',
												active
													? 'border-l-[3px] border-wiki-link bg-wiki-bg-tertiary font-medium text-wiki-text'
													: 'border-l-[3px] border-transparent text-wiki-text-secondary hover:bg-wiki-bg-tertiary hover:text-wiki-text',
											)}
										>
											{link.icon}
											<span>{link.label}</span>
										</a>
									</li>
								)
							})}
						</ul>
					</div>
				)
			})}
		</nav>
	)
}
