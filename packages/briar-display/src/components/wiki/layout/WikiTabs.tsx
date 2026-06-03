'use client'

import { cn } from '@/lib/utils'

type TabKey = 'read' | 'talk' | 'edit' | 'history'

interface WikiTabsProps {
	slug: string
	activeTab: TabKey
	discussionCount?: number
	className?: string
}

interface TabItem {
	key: TabKey
	label: string
	href: string
}

export default function WikiTabs({ slug, activeTab, discussionCount, className }: WikiTabsProps) {
	const tabs: TabItem[] = [
		{ key: 'read', label: '阅读', href: `/briar-display/wiki/${slug}` },
		{ key: 'talk', label: '讨论', href: `/briar-display/wiki/${slug}/talk` },
		{ key: 'edit', label: '编辑', href: `/briar-display/wiki/${slug}/edit` },
		{ key: 'history', label: '历史', href: `/briar-display/wiki/${slug}/history` },
	]

	return (
		<div className={cn('border-b border-border', className)}>
			<ul className="flex items-center gap-0">
				{tabs.map((tab) => {
					const isActive = tab.key === activeTab
					return (
						<li key={tab.key}>
							<a
								href={tab.href}
								className={cn(
									'inline-flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm transition-colors',
									isActive
										? 'border-primary font-medium text-foreground'
										: 'border-transparent text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground',
								)}
							>
								{tab.label}
								{tab.key === 'talk' && discussionCount != null && discussionCount > 0 && (
									<span
										className={cn(
											'rounded-full px-1.5 py-0.5 text-xs',
											isActive
												? 'bg-primary text-primary-foreground'
												: 'bg-muted text-muted-foreground',
										)}
									>
										{discussionCount}
									</span>
								)}
							</a>
						</li>
					)
				})}
			</ul>
		</div>
	)
}
