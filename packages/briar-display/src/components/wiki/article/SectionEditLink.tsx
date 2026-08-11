'use client'

import { cn } from '@/lib/utils'

interface SectionEditLinkProps {
	slug: string
	sectionId: string
	className?: string
}

export default function SectionEditLink({ slug, sectionId, className }: SectionEditLinkProps) {
	const href = `/briar/wiki/${slug}/edit?section=${encodeURIComponent(sectionId)}`

	return (
		<a
			href={href}
			className={cn(
				'float-right ml-2 text-[12px] text-wiki-link transition-colors hover:text-wiki-link-hover',
				className,
			)}
		>
			[编辑]
		</a>
	)
}
