'use client'

import { cn } from '@/lib/utils'

interface BreadcrumbItem {
	label: string
	href?: string
}

interface WikiBreadcrumbsProps {
	items: BreadcrumbItem[]
	className?: string
}

export default function WikiBreadcrumbs({ items, className }: WikiBreadcrumbsProps) {
	return (
		<nav aria-label="面包屑导航" className={cn('text-xs text-muted-foreground', className)}>
			<ol className="flex flex-wrap items-center gap-1">
				<li>
					<a href="/briar/wiki/" className="text-blue-600 hover:text-blue-800 hover:underline">
						首页
					</a>
				</li>
				{items.map((item, i) => (
					<li key={i} className="flex items-center gap-1">
						<span className="text-muted-foreground/50">{'>'}</span>
						{item.href ? (
							<a href={item.href} className="text-blue-600 hover:text-blue-800 hover:underline">
								{item.label}
							</a>
						) : (
							<span className="text-foreground">{item.label}</span>
						)}
					</li>
				))}
			</ol>
		</nav>
	)
}
