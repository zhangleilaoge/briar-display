import { Box, Text } from 'ink'
import TextInput from 'ink-text-input'
import React from 'react'
import type { FocusArea } from '../types.js'

export function InputBar({
	query,
	focus,
	completionMode,
	onChange,
	onSubmit,
}: {
	query: string
	focus: FocusArea
	completionMode: boolean
	onChange: (v: string) => void
	onSubmit: (v: string) => void
}) {
	return (
		<Box height={1} flexShrink={0} flexDirection="row">
			{focus === 'subAgents' ? (
				<Text color="yellow">{'  [←/Esc=back  ↑↓=select  Enter=chat  d=del]'}</Text>
			) : focus === 'sessions' ? (
				<Text color="yellow">{'  [←/Esc=cancel  ↑↓=select  Enter=switch]'}</Text>
			) : (
				<>
					<Box width={2} flexShrink={0}>
						<Text color="magenta">{'>'} </Text>
					</Box>
					<Box flexGrow={1}>
						<TextInput
							value={query}
							onChange={onChange}
							onSubmit={(v) => {
								if (!completionMode) onSubmit(v)
							}}
						/>
					</Box>
				</>
			)}
		</Box>
	)
}
