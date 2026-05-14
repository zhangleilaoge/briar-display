import { Box, Text } from 'ink'
import React from 'react'
import type { COMMANDS } from '../commands.js'

const MAX_VISIBLE = 6

export function CompletionPopup({
	items,
	selectedIndex,
}: { items: typeof COMMANDS; selectedIndex: number }) {
	const startIndex = Math.max(0, Math.min(selectedIndex, Math.max(0, items.length - MAX_VISIBLE)))
	const visibleItems = items.slice(startIndex, startIndex + MAX_VISIBLE)
	const adjustedSelectedIndex = selectedIndex - startIndex

	return (
		<Box flexDirection="column" width="100%" height={Math.min(items.length, MAX_VISIBLE)}>
			{visibleItems.map((cmd, i) => {
				const isSel = adjustedSelectedIndex === i
				const line = `${isSel ? '> ' : '  '}${cmd.name} — ${cmd.desc}`
				return (
					<Box key={cmd.name} flexDirection="row" width="100%">
						<Text bold={isSel} color={isSel ? 'cyan' : 'gray'}>
							{line}
						</Text>
					</Box>
				)
			})}
		</Box>
	)
}
