import { Box, Text } from 'ink'
import React from 'react'
import { getAgentColor } from '../agent.js'

export function Header({ label, senderId }: { label: string; senderId?: number }) {
	if (!label) return null
	const color =
		label === 'You'
			? 'magenta'
			: label === 'Briar'
				? 'blue'
				: senderId
					? getAgentColor(senderId)
					: 'blue'
	return (
		<Box height={1} flexShrink={0}>
			<Text bold color={color}>
				{'>> '}
				{label}
			</Text>
		</Box>
	)
}
