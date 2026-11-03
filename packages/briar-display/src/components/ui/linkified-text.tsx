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
	activeTags,
}: {
	text: string
	onTagClick?: (tag: string) => void
	activeTags?: readonly string[]
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
							'rv-thought-tag mx-0.5 inline-flex items-baseline rounded-sm border border-dashed px-1.5 py-px align-baseline text-[0.88em] leading-snug transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--rv-rose-deep)]/30',
							activeTags?.includes(part.tag)
								? 'border-solid border-[color:var(--rv-rose-deep)]/45 bg-[color:color-mix(in_srgb,var(--rv-rose)_65%,transparent)] text-[color:var(--rv-rose-deep)]'
								: 'border-[color:var(--rv-rose-deep)]/30 bg-[var(--rv-pink)]/30 text-[color:var(--rv-rose-deep)] hover:border-[color:var(--rv-rose-deep)]/55 hover:bg-[var(--rv-pink)]/65',
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
