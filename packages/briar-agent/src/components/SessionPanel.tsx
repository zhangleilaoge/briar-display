import { Box, Text } from 'ink'
import React from 'react'
import type { getSessions } from '../session.js'

export function SessionPanel({
	sessions,
	selectedIndex,
	currentId,
}: {
	sessions: ReturnType<typeof getSessions>
	selectedIndex: number
	currentId: string
}) {
	return (
		<Box width="70%" flexDirection="column" paddingRight={1}>
			<Box marginBottom={1}>
				<Text bold color="cyan">
					{'Select a session:'}
				</Text>
			</Box>
			{sessions.map((s, i) => {
				const isSel = selectedIndex === i
				const isCur = s.id === currentId
				return (
					<Box
						key={s.id}
						flexDirection="row"
						marginBottom={1}
						backgroundColor={isSel ? '#1a1a1a' : undefined}
					>
						<Text color={isSel ? 'cyan' : 'white'}>
							{isSel ? '> ' : '  '}
							{s.name}
							{isCur ? ' (current)' : ''}{' '}
							<Text color="gray">[{s.id.slice(0, 6)}] {new Date(s.updatedAt).toLocaleString()}</Text>
						</Text>
					</Box>
				)
			})}
		</Box>
	)
}
