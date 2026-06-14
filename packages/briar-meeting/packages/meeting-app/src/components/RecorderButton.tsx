import type { MeetingStatus } from '@briar/meeting-sdk'
import { Mic, Square } from 'lucide-react'

interface RecorderButtonProps {
	status: MeetingStatus
	onStart: () => void
	onStop: () => void
}

export function RecorderButton({ status, onStart, onStop }: RecorderButtonProps) {
	const isRecording = status === 'recording'

	return (
		<button
			onClick={isRecording ? onStop : onStart}
			className={`inline-flex h-12 items-center gap-2 rounded-full px-6 text-sm font-medium text-white shadow-lg transition ${
				isRecording ? 'bg-destructive hover:bg-destructive/90' : 'bg-primary hover:bg-primary/90'
			}`}
		>
			{isRecording ? <Square className="h-4 w-4 fill-current" /> : <Mic className="h-4 w-4" />}
			{isRecording ? '停止录制' : '开始录制'}
		</button>
	)
}
