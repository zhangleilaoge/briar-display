'use client'

import { cn } from '@/lib/utils'

interface WikiLinkProps {
	slug: string
	title?: string
	namespace?: string
	className?: string
}

export default function WikiLink({ slug, title, namespace, className }: WikiLinkProps) {
	const href = namespace
		? `/briar-display/wiki/${namespace}/${slug}`
		: `/briar-display/wiki/${slug}`

	return (
		<a href={href} className={cn('text-blue-600 hover:text-blue-800 hover:underline', className)}>
			{title || slug}
		</a>
	)
}
