/** Split plain text into text / http(s) URL parts for safe React rendering. */

export type LinkifyPart =
	| { type: 'text'; value: string }
	| { type: 'link'; href: string; value: string }

const URL_RE = /https?:\/\/[^\s<>"']+/gi
/** Trailing punctuation that is usually not part of the URL. */
const TRAILING_PUNCT_RE = /[),.;:!?'"！？。，、；：」』》】）》]+$/u

function peelTrailingPunct(raw: string): { href: string; trailing: string } {
	let href = raw
	let trailing = ''
	const match = href.match(TRAILING_PUNCT_RE)
	if (match) {
		trailing = match[0]
		href = href.slice(0, -trailing.length)
	}
	return { href, trailing }
}

export function splitLinkify(text: string): LinkifyPart[] {
	if (!text) return []

	const parts: LinkifyPart[] = []
	let lastIndex = 0

	for (const match of text.matchAll(URL_RE)) {
		const raw = match[0]
		const index = match.index ?? 0
		if (index > lastIndex) {
			parts.push({ type: 'text', value: text.slice(lastIndex, index) })
		}

		const { href, trailing } = peelTrailingPunct(raw)
		if (href && /^https?:\/\//i.test(href)) {
			parts.push({ type: 'link', href, value: href })
			if (trailing) parts.push({ type: 'text', value: trailing })
		} else {
			parts.push({ type: 'text', value: raw })
		}

		lastIndex = index + raw.length
	}

	if (lastIndex < text.length) {
		parts.push({ type: 'text', value: text.slice(lastIndex) })
	}

	return parts.length > 0 ? parts : [{ type: 'text', value: text }]
}
