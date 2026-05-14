import { Box, Text } from 'ink'
import React from 'react'
import { getAgentColor, getAgentDisplayName } from '../agent.js'
import type { FocusArea, SubAgent } from '../types.js'

export function SubAgentPanel({
	subAgents,
	focus,
	selectedIndex,
}: {
	subAgents: SubAgent[]
	focus: FocusArea
	selectedIndex: number
}) {
	return (
		<Box width="30%" flexDirection="column" paddingLeft={1}>
			<Box height={1} flexShrink={0}>
				<Text bold backgroundColor="#1a1a1a" color="white">
					{' Sub Agents '}
				</Text>
			</Box>
			<Box flexDirection="column" flexGrow={1} overflow="hidden">
				{subAgents.length === 0 && <Text color="gray">No sub-agents</Text>}
				{subAgents.map((agent, i) => {
					const isSel = focus === 'subAgents' && selectedIndex === i
					const color = getAgentColor(agent.id)
					const lastOut = agent.output[agent.output.length - 1]
					return (
						<Box
							key={agent.id}
							flexDirection="column"
							marginBottom={0}
							borderStyle="single"
							borderColor={isSel ? color : '#333333'}
						>
							<Box flexDirection="row" paddingX={1}>
								<Text bold color={color}>
									{isSel ? '> ' : '  '}
									{getAgentDisplayName(agent, subAgents)}
								</Text>
								<Text color="gray"> [{agent.status}]</Text>
							</Box>
							{lastOut && (
								<Box paddingX={1}>
									<Text color="gray" wrap="truncate-end">
										{lastOut.slice(0, 40)}
									</Text>
								</Box>
							)}
						</Box>
					)
				})}
			</Box>
		</Box>
	)
}
