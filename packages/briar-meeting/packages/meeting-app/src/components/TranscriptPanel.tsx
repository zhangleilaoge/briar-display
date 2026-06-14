import type { Meeting, Speaker, TranscriptSegment } from '@briar/meeting-sdk'
import { Check, Edit2 } from 'lucide-react'
import { useState } from 'react'
import { SpeakerBadge } from './SpeakerBadge'

interface TranscriptPanelProps {
	meeting: Meeting
	speakers: Speaker[]
	onUpdateSpeakerName: (speakerId: string, name: string) => void
}

export function TranscriptPanel({ meeting, speakers, onUpdateSpeakerName }: TranscriptPanelProps) {
	const [editingId, setEditingId] = useState<string | null>(null)
	const [editValue, setEditValue] = useState('')

	const getSpeaker = (id: string) => speakers.find((s) => s.id === id)

	const startEdit = (segment: TranscriptSegment) => {
		setEditingId(segment.id)
		setEditValue(getSpeaker(segment.speakerId)?.name ?? '')
	}

	const saveEdit = (speakerId: string) => {
		if (editValue.trim()) {
			onUpdateSpeakerName(speakerId, editValue.trim())
		}
		setEditingId(null)
	}

	const formatTime = (ms: number) => {
		const totalSeconds = Math.floor(ms / 1000)
		const minutes = Math.floor(totalSeconds / 60)
		const seconds = totalSeconds % 60
		return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
	}

	return (
		<div className="h-full overflow-y-auto p-4">
			<div className="space-y-4">
				{meeting.segments.length === 0 ? (
					<div className="py-12 text-center text-muted-foreground">
						开始录制后，原文对话将实时显示在这里
					</div>
				) : (
					meeting.segments.map((segment) => {
						const speaker = getSpeaker(segment.speakerId)
						return (
							<div
								key={segment.id}
								className={`flex gap-3 rounded-xl border p-4 transition ${
									segment.isInterim
										? 'border-dashed border-primary/30 bg-primary/5'
										: 'border-border bg-card'
								}`}
							>
								<div className="mt-0.5 shrink-0">
									{editingId === segment.id ? (
										<div className="flex items-center gap-1">
											<input
												type="text"
												value={editValue}
												onChange={(e) => setEditValue(e.target.value)}
												className="w-24 rounded border border-border bg-background px-2 py-0.5 text-xs"
												onKeyDown={(e) => {
													if (e.key === 'Enter') saveEdit(segment.speakerId)
													if (e.key === 'Escape') setEditingId(null)
												}}
											/>
											<button
												onClick={() => saveEdit(segment.speakerId)}
												className="rounded p-0.5 hover:bg-accent"
											>
												<Check className="h-3.5 w-3.5" />
											</button>
										</div>
									) : (
										<div className="flex items-center gap-1">
											<SpeakerBadge name={speaker?.name ?? '未知'} color={speaker?.color} />
											<button
												onClick={() => startEdit(segment)}
												className="rounded p-0.5 text-muted-foreground opacity-0 hover:bg-accent hover:text-foreground"
											>
												<Edit2 className="h-3 w-3" />
											</button>
										</div>
									)}
								</div>
								<div className="flex-1">
									<p className="text-sm leading-relaxed">{segment.text}</p>
									<span className="mt-1 block text-xs text-muted-foreground">
										{formatTime(segment.startTime)}
									</span>
								</div>
							</div>
						)
					})
				)}
			</div>
		</div>
	)
}
