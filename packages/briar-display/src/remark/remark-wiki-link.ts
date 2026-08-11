/**
 * remark plugin to parse MediaWiki-style internal links: [[Page title|display text]]
 * Converts them to standard anchor elements linking to /briar/wiki/{slug}
 */
import type { Root } from 'mdast'
import type { Plugin } from 'unified'
import { visit } from 'unist-util-visit'

const WIKI_LINK_REGEX = /\[\[([^\]|]+)(\|([^\]]*))?\]\]/g

const remarkWikiLink: Plugin<[], Root> = () => {
	return (tree) => {
		visit(tree, 'text', (node, index, parent) => {
			if (!parent || index === undefined) return

			const { value } = node
			const matches = [...value.matchAll(WIKI_LINK_REGEX)]

			if (matches.length === 0) return

			const children: any[] = []
			let lastIndex = 0

			for (const match of matches) {
				const matchIndex = match.index

				// Add text before the match
				if (matchIndex > lastIndex) {
					children.push({ type: 'text', value: value.slice(lastIndex, matchIndex) })
				}

				const pageName = match[1].trim()
				const displayText = match[3]?.trim() || pageName
				const slug = encodeURIComponent(pageName)

				// Create wiki link node
				children.push({
					type: 'link',
					url: `/briar/wiki/${slug}`,
					title: pageName,
					children: [{ type: 'text', value: displayText }],
					data: {
						hProperties: {
							className: 'wiki-link',
							'data-wiki-page': pageName,
						},
					},
				})

				lastIndex = matchIndex + match[0].length
			}

			// Add remaining text
			if (lastIndex < value.length) {
				children.push({ type: 'text', value: value.slice(lastIndex) })
			}

			// Replace the original text node with the new children
			parent.children.splice(index, 1, ...children)
			return index + children.length
		})
	}
}

export default remarkWikiLink
