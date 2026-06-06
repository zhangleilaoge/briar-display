import { Mark } from '@tiptap/core'

const WIKI_LINK_REGEX = /^\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/

export const WikiLink = Mark.create({
	name: 'wikiLink',
	priority: 1100,

	addOptions() {
		return {
			HTMLAttributes: {
				class: 'wiki-link text-wiki-link hover:underline cursor-pointer',
			},
		}
	},

	addAttributes() {
		return {
			href: {
				default: null,
			},
			title: {
				default: null,
			},
			'data-wiki-page': {
				default: null,
			},
		}
	},

	parseHTML() {
		return [
			{
				tag: 'span[data-wiki-link]',
				getAttrs: (element) => {
					const el = element as HTMLElement
					return {
						href: el.getAttribute('data-wiki-href'),
						title: el.getAttribute('data-wiki-link'),
						'data-wiki-page': el.getAttribute('data-wiki-link'),
					}
				},
			},
		]
	},

	renderHTML({ HTMLAttributes }) {
		return ['a', { ...this.options.HTMLAttributes, ...HTMLAttributes }, 0]
	},

	addStorage() {
		return {
			markdown: {
				serialize: {
					open: (state, mark, parent, index) => {
						const pageName =
							(mark.attrs['data-wiki-page'] as string) || (mark.attrs.title as string) || ''
						const node = parent?.child(index)
						const text = node?.text || ''
						if (pageName && pageName !== text) {
							return `[[${pageName}|`
						}
						return '[['
					},
					close: ']]',
					mixable: true,
					expelEnclosingWhitespace: true,
				},
				parse: {
					setup(md) {
						// 避免重复注册规则
						const idx = md.inline.ruler.__find__('wiki_link')
						if (idx !== undefined && idx >= 0) {
							md.inline.ruler.__rules__.splice(idx, 1)
						}

						md.inline.ruler.before('link', 'wiki_link', (state, silent) => {
							const src = state.src.slice(state.pos)
							const match = WIKI_LINK_REGEX.exec(src)
							if (!match) return false

							if (silent) return true

							const pageName = match[1].trim()
							const displayText = match[2]?.trim() || pageName
							const slug = encodeURIComponent(pageName)

							const tokenOpen = state.push('wiki_link_open', 'span', 1)
							tokenOpen.attrs = [
								['data-wiki-link', pageName],
								['data-wiki-href', `/briar-display/wiki/${slug}`],
								['class', 'wiki-link'],
							]

							const tokenText = state.push('text', '', 0)
							tokenText.content = displayText

							state.push('wiki_link_close', 'span', -1)

							state.pos += match[0].length
							return true
						})
					},
				},
			},
		}
	},
})
