import { ArrowLeft, FileText, LayoutList, Settings, Type } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { PdfUploader } from '../components/PdfUploader'
import { RecorderButton } from '../components/RecorderButton'
import { SettingsModal } from '../components/SettingsModal'
import { SummaryPanel } from '../components/SummaryPanel'
import { TranscriptPanel } from '../components/TranscriptPanel'
import { useMeetingSession } from '../hooks/useMeetingSession'

interface MeetingProps {
	meetingId?: string
	onBack: () => void
}

type ViewMode = 'transcript' | 'summary'

export function Meeting({ meetingId, onBack }: MeetingProps) {
	const {
		meeting,
		status,
		speakers,
		error,
		start,
		stop,
		updateTitle,
		updateSpeakerName,
		updatePdfContext,
	} = useMeetingSession({ meetingId })

	const [viewMode, setViewMode] = useState<ViewMode>('transcript')
	const [settingsOpen, setSettingsOpen] = useState(false)
	const [recordingSeconds, setRecordingSeconds] = useState(0)
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
	const scrollRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		if (status === 'recording') {
			timerRef.current = setInterval(() => {
				setRecordingSeconds((s) => s + 1)
			}, 1000)
		} else {
			if (timerRef.current) clearInterval(timerRef.current)
		}
		return () => {
			if (timerRef.current) clearInterval(timerRef.current)
		}
	}, [status])

	useEffect(() => {
		if (scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight
		}
	}, [meeting?.segments.length, meeting?.summaries.length, viewMode])

	const formatDuration = (seconds: number) => {
		const m = Math.floor(seconds / 60)
			.toString()
			.padStart(2, '0')
		const s = (seconds % 60).toString().padStart(2, '0')
		return `${m}:${s}`
	}

	if (!meeting) {
		return (
			<div className="flex h-screen items-center justify-center text-muted-foreground">
				加载中...
			</div>
		)
	}

	return (
		<div className="flex h-screen flex-col bg-background">
			<header className="flex items-center justify-between border-b border-border px-6 py-4">
				<div className="flex items-center gap-4">
					<button
						onClick={onBack}
						className="rounded-lg p-2 text-muted-foreground hover:bg-secondary"
					>
						<ArrowLeft className="h-5 w-5" />
					</button>
					<input
						type="text"
						value={meeting.title}
						onChange={(e) => updateTitle(e.target.value)}
						className="border-none bg-transparent text-lg font-semibold outline-none placeholder:text-muted-foreground"
						placeholder="会议标题"
					/>
				</div>

				<div className="flex items-center gap-4">
					{status === 'recording' && (
						<div className="flex items-center gap-2 text-sm font-medium text-destructive">
							<span className="relative flex h-2.5 w-2.5">
								<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
								<span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-destructive" />
							</span>
							{formatDuration(recordingSeconds)}
						</div>
					)}
					<PdfUploader
						pdfContext={meeting.pdfContext}
						onUpload={updatePdfContext}
						onClear={() => updatePdfContext('')}
					/>
					<button
						onClick={() => setSettingsOpen(true)}
						className="rounded-lg p-2 text-muted-foreground hover:bg-secondary"
					>
						<Settings className="h-5 w-5" />
					</button>
					<RecorderButton status={status} onStart={start} onStop={stop} />
				</div>
			</header>

			{error && (
				<div className="border-b border-destructive/20 bg-destructive/10 px-6 py-2 text-sm text-destructive">
					{error}
				</div>
			)}

			<div className="flex flex-1 overflow-hidden">
				<div className="flex w-16 flex-col items-center gap-2 border-r border-border py-4">
					<button
						onClick={() => setViewMode('transcript')}
						className={`rounded-xl p-3 transition ${
							viewMode === 'transcript'
								? 'bg-primary text-primary-foreground'
								: 'text-muted-foreground hover:bg-secondary'
						}`}
						title="原文对话"
					>
						<Type className="h-5 w-5" />
					</button>
					<button
						onClick={() => setViewMode('summary')}
						className={`rounded-xl p-3 transition ${
							viewMode === 'summary'
								? 'bg-primary text-primary-foreground'
								: 'text-muted-foreground hover:bg-secondary'
						}`}
						title="分块总结"
					>
						<LayoutList className="h-5 w-5" />
					</button>
				</div>

				<div className="flex-1 overflow-hidden" ref={scrollRef}>
					{viewMode === 'transcript' ? (
						<TranscriptPanel
							meeting={meeting}
							speakers={speakers}
							onUpdateSpeakerName={updateSpeakerName}
						/>
					) : (
						<SummaryPanel meeting={meeting} />
					)}
				</div>
			</div>

			{meeting.pdfContext && (
				<div className="flex items-center gap-2 border-t border-border bg-secondary px-6 py-2 text-xs text-muted-foreground">
					<FileText className="h-3.5 w-3.5" />
					<span>已加载 PDF 上下文（{meeting.pdfContext.length} 字符）</span>
				</div>
			)}

			<SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
		</div>
	)
}
