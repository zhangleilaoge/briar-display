'use client'

import { cn } from '@/lib/utils'
import {
	BarChart3,
	Bookmark,
	FileText,
	FolderTree,
	Home,
	LayoutList,
	Link2,
	Star,
	TrendingUp,
} from 'lucide-react'

interface SidebarLink {
	label: string
	href: string
	icon?: React.ReactNode
}

interface SidebarSection {
	title?: string
	links: SidebarLink[]
}

interface WikiSidebarProps {
	className?: string
}

const navigation: SidebarSection[] = [
	{
		links: [
			{ label: '首页', href: '/briar-display/wiki/', icon: <Home className="h-4 w-4" /> },
			{
				label: '最近更改',
				href: '/briar-display/wiki/special/recent-changes',
				icon: <TrendingUp className="h-4 w-4" />,
			},
			{
				label: '所有页面',
				href: '/briar-display/wiki/special/all-pages',
				icon: <FileText className="h-4 w-4" />,
			},
			{
				label: '分类',
				href: '/briar-display/wiki/category/',
				icon: <FolderTree className="h-4 w-4" />,
			},
			{
				label: '模板',
				href: '/briar-display/wiki/special/all-pages',
				icon: <LayoutList className="h-4 w-4" />,
			},
		],
	},
	{
		title: '工具',
		links: [
			{
				label: '孤立页面',
				href: '/briar-display/wiki/special/orphaned-pages',
				icon: <Link2 className="h-4 w-4" />,
			},
			{
				label: '期望页面',
				href: '/briar-display/wiki/special/wanted-pages',
				icon: <FileText className="h-4 w-4" />,
			},
			{
				label: '统计',
				href: '/briar-display/wiki/special/statistics',
				icon: <BarChart3 className="h-4 w-4" />,
			},
		],
	},
	{
		title: '用户',
		links: [
			{
				label: '关注列表',
				href: '/briar-display/wiki/special/watchlist',
				icon: <Bookmark className="h-4 w-4" />,
			},
			{
				label: '我的贡献',
				href: '/briar-display/wiki/special/recent-changes',
				icon: <Star className="h-4 w-4" />,
			},
		],
	},
]

export default function WikiSidebar({ className }: WikiSidebarProps) {
	return (
		<nav className={cn('space-y-4 text-sm', className)}>
			{navigation.map((section, i) => (
				<div key={i}>
					{section.title && (
						<h3 className="mb-1 px-2 pb-1 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
							{section.title}
						</h3>
					)}
					<ul className="space-y-0.5">
						{section.links.map((link) => (
							<li key={link.href}>
								<a
									href={link.href}
									className={cn(
										'flex items-center gap-2 rounded-md px-2 py-1.5 text-foreground transition-colors',
										'hover:bg-muted hover:text-foreground',
									)}
								>
									{link.icon}
									<span>{link.label}</span>
								</a>
							</li>
						))}
					</ul>
				</div>
			))}
		</nav>
	)
}
