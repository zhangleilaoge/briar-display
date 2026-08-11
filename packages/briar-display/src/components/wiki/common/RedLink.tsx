'use client'

import { cn } from '@/lib/utils'

interface RedLinkProps {
	slug: string
	title?: string
	className?: string
}

export default function RedLink({ slug, title, className }: RedLinkProps) {
	return (
		<a
			href={`/briar/wiki/${slug}/edit`}
			className={cn(
				'border-b border-dashed border-red-500 text-red-600 hover:text-red-800',
				className,
			)}
			title="页面不存在，点击创建"
		>
			{title || slug}
		</a>
	)
}
