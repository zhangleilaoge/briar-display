'use client'

import { usePermissions } from '@/contexts/PermissionContext'
import { cn } from '@/lib/utils'
import { PERMISSIONS } from '@briar/shared'

type TabKey = 'read' | 'talk' | 'edit' | 'history'

interface WikiTabsProps {
	slug: string
	active: TabKey
	discussionCount?: number
	className?: string
}

export default function WikiTabs({ slug, active, discussionCount, className }: WikiTabsProps) {
	const { hasPermission, isAdmin } = usePermissions()

	const allTabs: { key: TabKey; label: string; href: string; requirePermission?: string }[] = [
		{ key: 'read', label: '阅读', href: `/briar-display/wiki/${slug}` },
		{ key: 'talk', label: '讨论', href: `/briar-display/wiki/${slug}/talk` },
		{
			key: 'edit',
			label: '编辑',
			href: `/briar-display/wiki/${slug}/edit`,
			requirePermission: PERMISSIONS.WIKI_PAGE_UPDATE,
		},
		{ key: 'history', label: '历史', href: `/briar-display/wiki/${slug}/history` },
	]

	const tabs = allTabs.filter(
		(tab) => !tab.requirePermission || isAdmin || hasPermission(tab.requirePermission),
	)

	return (
		<div className={cn('w-full border-b border-wiki-border-light', className)}>
			<nav className="flex items-end gap-0" aria-label="文章操作">
				{tabs.map((tab) => {
					const isActive = tab.key === active
					return (
						<a
							key={tab.key}
							href={tab.href}
							className={cn(
								'inline-flex items-center gap-1.5 px-4 py-2 text-[13px] transition-colors border-b-[3px]',
								isActive
									? 'border-wiki-tab-active text-wiki-text font-medium'
									: 'border-transparent text-wiki-text-secondary hover:text-wiki-link hover:border-wiki-border-light',
							)}
						>
							{tab.label}
							{tab.key === 'talk' && discussionCount != null && discussionCount > 0 && (
								<span
									className={cn(
										'ml-0.5 rounded-full px-1.5 py-0.5 text-[11px] leading-none',
										isActive
											? 'bg-wiki-tab-active text-white'
											: 'bg-wiki-bg-tertiary text-wiki-text-secondary',
									)}
								>
									{discussionCount}
								</span>
							)}
						</a>
					)
				})}
			</nav>
		</div>
	)
}
