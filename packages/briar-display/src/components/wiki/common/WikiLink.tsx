'use client'

import { cn } from '@/lib/utils'

interface WikiLinkProps {
	slug: string
	title?: string
	namespace?: string
	className?: string
}

export default function WikiLink({ slug, title, namespace, className }: WikiLinkProps) {
	// main 是默认命名空间，URL 中不显示
	const href =
		namespace && namespace !== 'main'
			? `/briar-display/wiki/${namespace}/${slug}`
			: `/briar-display/wiki/${slug}`

	return (
		<a href={href} className={cn('text-blue-600 hover:text-blue-800 hover:underline', className)}>
			{title || slug}
		</a>
	)
}
