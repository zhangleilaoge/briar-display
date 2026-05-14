import { Box, Text } from 'ink'
import { ScrollView, type ScrollViewRef } from 'ink-scroll-view'
import type React from 'react'
import { getAgentColor } from '../agent.js'
import type { Message } from '../types.js'

export function ChatPanel({
	messages,
	isLoading,
	scrollRef,
	onScroll,
	onContentHeightChange,
}: {
	messages: Message[]
	isLoading: boolean
	scrollRef: React.RefObject<ScrollViewRef | null>
	onScroll: (offset: number) => void
	onContentHeightChange?: (height: number, previousHeight: number) => void
}) {
	return (
		<Box width="70%" flexDirection="column" paddingRight={1}>
			{messages.length === 0 && (
				<Text color="gray"> Welcome! Type your message and press Enter. </Text>
			)}
			{messages.length > 0 && (
				<ScrollView
					ref={scrollRef}
					onScroll={onScroll}
					flexGrow={1}
					onContentHeightChange={(height, prevHeight) => {
						onContentHeightChange?.(height, prevHeight)
						setTimeout(() => scrollRef.current?.scrollToBottom(), 10)
					}}
				>
					{messages.map((msg, i) => (
						<Box key={i} flexDirection="row" marginBottom={1}>
							<Box width={12} flexShrink={0}>
								<Text
									bold
									color={
										msg.role === 'user'
											? 'magenta'
											: msg.senderId
												? getAgentColor(msg.senderId)
												: 'blue'
									}
								>
									{msg.sender || (msg.role === 'user' ? 'You' : 'Briar')}
								</Text>
							</Box>
							<Box flexGrow={1}>
								<Text>
									{msg.content}
									{msg.cancelled && <Text color="gray"> [Cancelled]</Text>}
								</Text>
							</Box>
						</Box>
					))}
					{isLoading && messages[messages.length - 1]?.role === 'user' && (
						<Box flexDirection="row" marginBottom={1}>
							<Box width={12} flexShrink={0}>
								<Text bold color="blue">
									Briar
								</Text>
							</Box>
							<Box flexGrow={1}>
								<Text color="gray">Thinking...</Text>
							</Box>
						</Box>
					)}
				</ScrollView>
			)}
		</Box>
	)
}
