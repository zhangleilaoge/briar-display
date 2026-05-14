import { Box, Text } from 'ink'
import React from 'react'
import { getAgentColor } from '../agent.js'

export function Header({
	label,
	senderId,
	scrollInfo,
}: {
	label: string
	senderId?: number
	scrollInfo?: { offset: number; content: number; viewport: number }
}) {
	if (!label) return null
	const color =
		label === 'You'
			? 'magenta'
			: label === 'Briar'
				? 'blue'
				: senderId
					? getAgentColor(senderId)
					: 'blue'

	const scrollText = (() => {
		if (!scrollInfo) return ''
		const { offset, content, viewport } = scrollInfo
		const maxOffset = Math.max(0, content - viewport)
		if (maxOffset <= 0) return ''
		return `${offset}/${maxOffset}`
	})()

	return (
		<Box height={1} flexShrink={0} flexDirection="row">
			<Box flexGrow={1}>
				<Text bold color={color}>
					{'>> '}
					{label}
				</Text>
			</Box>
			{scrollText && (
				<Box>
					<Text color="gray">{scrollText}</Text>
				</Box>
			)}
		</Box>
	)
}
