import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

export interface SlashCommand {
	label: string
	description: string
	icon: string
	action: (editor: import('@tiptap/core').Editor) => void
}

export const slashCommandKey = new PluginKey('slashCommand')

export function createSlashCommandExtension(commands: SlashCommand[]) {
	return Extension.create({
		name: 'slashCommand',

		addProseMirrorPlugins() {
			return [
				new Plugin({
					key: slashCommandKey,
					props: {
						handleKeyDown: (view, event) => {
							// Let the React component handle everything
							return false
						},
						decorations(state) {
							const { doc, selection } = state
							if (!selection.empty) return DecorationSet.empty

							const $from = selection.$from
							const text = $from.parent.textContent
							const cursorPos = $from.parentOffset

							// Find slash at cursor position
							const beforeCursor = text.slice(0, cursorPos)
							const slashMatch = beforeCursor.match(/^\/(.*)$/)
							if (!slashMatch) return DecorationSet.empty

							// Create a decoration to highlight the slash command
							const start = $from.start()
							const end = start + cursorPos
							const deco = Decoration.inline(start, end, {
								class: 'slash-command-text',
							})
							return DecorationSet.create(doc, [deco])
						},
					},
				}),
			]
		},
	})
}
