'use client'

import { type LinkifyPart, splitLinkify } from '@/lib/linkify'
import { cn } from '@/lib/utils'
import { useMemo } from 'react'

/**
 * Render plain text with http(s) URLs as clickable links (new tab).
 * Pass `onTagClick` to also render `#标签` as clickable chips.
 */
export function LinkifiedText({
	text,
	onTagClick,
	activeTag,
}: {
	text: string
	onTagClick?: (tag: string) => void
	activeTag?: string | null
}) {
	const withTags = !!onTagClick
	const parts = useMemo(() => splitLinkify(text, { tags: withTags }), [text, withTags])
	return (
		<>
			{parts.map((part: LinkifyPart, i) =>
				part.type === 'link' ? (
					<a
						key={`l-${i}`}
						href={part.href}
						target="_blank"
						rel="noopener noreferrer"
						className="break-all text-[color:var(--rv-rose-deep)] underline underline-offset-2 hover:opacity-80"
						onClick={(e) => e.stopPropagation()}
					>
						{part.value}
					</a>
				) : part.type === 'tag' ? (
					<button
						key={`g-${i}`}
						type="button"
						onClick={(e) => {
							e.stopPropagation()
							onTagClick?.(part.tag)
						}}
						className={cn(
							'rv-thought-tag mx-0.5 inline-flex items-baseline rounded-none border border-dashed px-1 py-0 align-baseline text-[0.92em] leading-snug transition-colors',
							activeTag === part.tag
								? 'border-[color:var(--rv-rose-deep)] bg-[color:var(--rv-rose)]/25 text-[color:var(--rv-rose-deep)]'
								: 'border-[color:var(--rv-rose)]/70 bg-[var(--rv-pink)]/40 text-[color:var(--rv-rose-deep)] hover:bg-[var(--rv-pink)]/80',
						)}
						title={`查看 ${part.value} 的想法`}
					>
						{part.value}
					</button>
				) : (
					<span key={`t-${i}`}>{part.value}</span>
				),
			)}
		</>
	)
}
