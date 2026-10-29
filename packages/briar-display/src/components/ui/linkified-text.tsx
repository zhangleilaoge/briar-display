'use client'

import { type LinkifyPart, splitLinkify } from '@/lib/linkify'
import { useMemo } from 'react'

/** Render plain text with http(s) URLs as clickable links (new tab). */
export function LinkifiedText({ text }: { text: string }) {
	const parts = useMemo(() => splitLinkify(text), [text])
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
				) : (
					<span key={`t-${i}`}>{part.value}</span>
				),
			)}
		</>
	)
}
