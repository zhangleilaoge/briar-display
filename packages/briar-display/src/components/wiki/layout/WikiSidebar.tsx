'use client'

import { usePermissions } from '@/contexts/PermissionContext'
import { cn } from '@/lib/utils'
import {
	BarChart3,
	Eye,
	FileText,
	History,
	Home,
	LayoutList,
	Link2,
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
			{ label: '首页', href: '/briar/wiki/', icon: <Home className="h-3.5 w-3.5" /> },
			{
				label: '最近更改',
				href: '/briar/wiki/special/recent-changes',
				icon: <TrendingUp className="h-3.5 w-3.5" />,
			},
			{
				label: '所有页面',
				href: '/briar/wiki/special/all-pages',
				icon: <FileText className="h-3.5 w-3.5" />,
			},
			{
				label: '分类',
				href: '/briar/wiki/category/',
				icon: <LayoutList className="h-3.5 w-3.5" />,
			},
			{
				label: '标签',
				href: '/briar/wiki/special/tags',
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
				href: '/briar/wiki/special/watchlist',
				icon: <Eye className="h-3.5 w-3.5" />,
			},
			{
				label: '我的收藏',
				href: '/briar/wiki/special/stars',
				icon: <Star className="h-3.5 w-3.5" />,
			},
			{
				label: '我的贡献',
				href: '/briar/wiki/special/user-contributions',
				icon: <History className="h-3.5 w-3.5" />,
			},
		],
	},
	{
		title: '工具',
		links: [
			{
				label: '孤立页面',
				href: '/briar/wiki/special/orphaned-pages',
				icon: <Link2 className="h-3.5 w-3.5" />,
			},
			{
				label: '期望页面',
				href: '/briar/wiki/special/wanted-pages',
				icon: <FileText className="h-3.5 w-3.5" />,
			},
			{
				label: '模板',
				href: '/briar/wiki/special/templates',
				icon: <LayoutList className="h-3.5 w-3.5" />,
			},
			{
				label: '统计',
				href: '/briar/wiki/special/statistics',
				icon: <BarChart3 className="h-3.5 w-3.5" />,
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
	if (normHref === '/briar/wiki') return normPath === '/briar/wiki'

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
		<nav className="px-3 py-4">
			{sections.map((section, sectionIdx) => {
				if (section.requireAuth && !isLoggedIn) return null
				if (section.requirePermission && !hasPermission(section.requirePermission)) return null

				const visibleLinks = section.links.filter(
					(link) => !link.requirePermission || hasPermission(link.requirePermission),
				)
				if (visibleLinks.length === 0) return null

				return (
					<div key={section.title} className={sectionIdx > 0 ? 'mt-4' : ''}>
						<h3 className="mb-1 px-2 text-[13px] font-semibold tracking-wide text-wiki-text-muted">
							{section.title}
						</h3>
						<ul className="space-y-0.5">
							{visibleLinks.map((link) => {
								const active = isActiveLink(link.href, pathname)
								return (
									<li key={link.href}>
										<a
											href={link.href}
											className={cn(
												'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] transition-colors',
												active
													? 'bg-wiki-bg-tertiary font-medium text-wiki-text'
													: 'text-wiki-text-secondary hover:bg-wiki-bg-tertiary hover:text-wiki-text',
											)}
										>
											<span className={cn('text-wiki-text-muted', active && 'text-wiki-link')}>
												{link.icon}
											</span>
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
