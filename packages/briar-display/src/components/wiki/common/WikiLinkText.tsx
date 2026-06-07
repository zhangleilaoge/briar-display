import type React from 'react'

interface WikiLinkTextProps {
	text: string
	highlightQuery?: string
	className?: string
}

export default function WikiLinkText({ text, highlightQuery, className }: WikiLinkTextProps) {
	const wikiRegex = /\[\[([^\]|]+)(\|([^\]]*))?\]\]/g
	const nodes: React.ReactNode[] = []
	let lastIndex = 0
	let match: RegExpExecArray | null

	const highlight = (str: string, baseKey: string): React.ReactNode[] => {
		if (!highlightQuery?.trim()) return [<span key={baseKey}>{str}</span>]

		const keywords = highlightQuery
			.trim()
			.split(/\s+/)
			.filter((k) => k.length > 0)
		if (keywords.length === 0) return [<span key={baseKey}>{str}</span>]

		const pattern = keywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
		const hlRegex = new RegExp(`(${pattern})`, 'gi')
		const parts = str.split(hlRegex)
		const result: React.ReactNode[] = []

		parts.forEach((part, i) => {
			const isMatch = keywords.some((k) => part.toLowerCase() === k.toLowerCase())
			result.push(
				isMatch ? (
					<mark
						key={`${baseKey}-hl-${i}`}
						className="rounded-sm bg-wiki-highlight px-0.5 text-wiki-text"
					>
						{part}
					</mark>
				) : (
					<span key={`${baseKey}-txt-${i}`}>{part}</span>
				),
			)
		})

		return result
	}

	match = wikiRegex.exec(text)
	while (match !== null) {
		const before = text.slice(lastIndex, match.index)
		if (before) {
			nodes.push(...highlight(before, `b-${match.index}`))
		}

		const pageName = match[1].trim()
		const displayText = match[3]?.trim() || pageName
		const slug = encodeURIComponent(pageName)

		nodes.push(
			<a
				key={`link-${match.index}`}
				href={`/briar-display/wiki/${slug}`}
				className="text-wiki-link hover:underline"
				onClick={(e) => e.stopPropagation()}
			>
				{highlight(displayText, `d-${match.index}`)}
			</a>,
		)

		lastIndex = wikiRegex.lastIndex
		match = wikiRegex.exec(text)
	}

	const after = text.slice(lastIndex)
	if (after) {
		nodes.push(...highlight(after, 'a-end'))
	}

	return <span className={className}>{nodes}</span>
}
