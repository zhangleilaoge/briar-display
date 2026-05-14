import { Box, Text } from 'ink'
import React from 'react'
import type { COMMANDS } from '../commands.js'

export function CompletionPopup({
	items,
	selectedIndex,
}: { items: typeof COMMANDS; selectedIndex: number }) {
	return (
		<Box flexDirection="column" marginTop={1}>
			{items.map((cmd, i) => (
				<Box key={cmd.name} flexDirection="row">
					<Text color={selectedIndex === i ? 'cyan' : 'gray'}>
						{selectedIndex === i ? '> ' : '  '}
						{cmd.name}
					</Text>
					<Text color="gray">
						{' — '}
						{cmd.desc}
					</Text>
				</Box>
			))}
		</Box>
	)
}
