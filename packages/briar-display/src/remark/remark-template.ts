/**
 * remark plugin to parse MediaWiki-style template transclusion: {{TemplateName|param1=value1|param2=value2}}
 * Converts them to special elements that can be rendered by the frontend.
 * For now, renders as a styled placeholder block showing template name and params.
 */
import type { Root } from 'mdast'
import type { Plugin } from 'unified'
import { visit } from 'unist-util-visit'

const TEMPLATE_REGEX = /\{\{([^|}]+)(\|([^}]*))?\}\}/g

const remarkTemplate: Plugin<[], Root> = () => {
	return (tree) => {
		visit(tree, 'text', (node, index, parent) => {
			if (!parent || index === undefined) return

			const { value } = node
			const matches = [...value.matchAll(TEMPLATE_REGEX)]

			if (matches.length === 0) return

			const children: any[] = []
			let lastIndex = 0

			for (const match of matches) {
				const matchIndex = match.index

				// Add text before the match
				if (matchIndex > lastIndex) {
					children.push({ type: 'text', value: value.slice(lastIndex, matchIndex) })
				}

				const templateName = match[1].trim()
				const params = match[3]?.trim() || ''

				// Create template placeholder as inline code with special styling
				const displayText = params ? `📄 ${templateName} (${params})` : `📄 ${templateName}`

				children.push({
					type: 'link',
					url: `/briar-display/wiki/template/${encodeURIComponent(templateName)}`,
					title: `模板: ${templateName}`,
					children: [{ type: 'text', value: displayText }],
					data: {
						hProperties: {
							className:
								'inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-sm text-blue-700 hover:bg-blue-100 wiki-template',
							'data-template': templateName,
						},
					},
				})

				lastIndex = matchIndex + match[0].length
			}

			// Add remaining text
			if (lastIndex < value.length) {
				children.push({ type: 'text', value: value.slice(lastIndex) })
			}

			parent.children.splice(index, 1, ...children)
			return index + children.length
		})
	}
}

export default remarkTemplate
