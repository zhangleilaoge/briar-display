/** Split plain text into text / http(s) URL parts for safe React rendering. */

export type LinkifyPart =
	| { type: 'text'; value: string }
	| { type: 'link'; href: string; value: string }

/**
 * ASCII URL body only — never swallows whitespace, CJK, or other non-URL text.
 * Trailing punctuation that isn't part of the URL is peeled below.
 */
const URL_RE = /https?:\/\/[a-zA-Z0-9][a-zA-Z0-9\-._~:/?#\[\]@!$&'()*+,;=%]*/gi

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

function pushText(parts: LinkifyPart[], value: string) {
	if (!value) return
	const last = parts[parts.length - 1]
	if (last?.type === 'text') {
		last.value += value
	} else {
		parts.push({ type: 'text', value })
	}
}

export function splitLinkify(text: string): LinkifyPart[] {
	if (!text) return []

	const parts: LinkifyPart[] = []
	let lastIndex = 0

	for (const match of text.matchAll(URL_RE)) {
		const raw = match[0]
		const index = match.index ?? 0
		if (index > lastIndex) {
			pushText(parts, text.slice(lastIndex, index))
		}

		const { href, trailing } = peelTrailingPunct(raw)
		if (href && /^https?:\/\/[a-zA-Z0-9]/i.test(href)) {
			parts.push({ type: 'link', href, value: href })
			pushText(parts, trailing)
		} else {
			pushText(parts, raw)
		}

		lastIndex = index + raw.length
	}

	if (lastIndex < text.length) {
		pushText(parts, text.slice(lastIndex))
	}

	return parts.length > 0 ? parts : [{ type: 'text', value: text }]
}
