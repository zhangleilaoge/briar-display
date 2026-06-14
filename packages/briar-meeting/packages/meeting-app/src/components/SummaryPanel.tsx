import type { Meeting, SummaryChunk } from '@briar/meeting-sdk'
import { Sparkles } from 'lucide-react'

interface SummaryPanelProps {
	meeting: Meeting
}

export function SummaryPanel({ meeting }: SummaryPanelProps) {
	const formatTime = (ms: number) => {
		const totalSeconds = Math.floor(ms / 1000)
		const minutes = Math.floor(totalSeconds / 60)
		const seconds = totalSeconds % 60
		return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
	}

	const renderMarkdown = (content: string) => {
		return content.split('\n').map((line, index) => {
			if (line.startsWith('# '))
				return (
					<h3 key={index} className="mt-3 text-base font-semibold">
						{line.slice(2)}
					</h3>
				)
			if (line.startsWith('## '))
				return (
					<h4 key={index} className="mt-2 text-sm font-semibold">
						{line.slice(3)}
					</h4>
				)
			if (line.startsWith('- '))
				return (
					<li key={index} className="ml-4 text-sm">
						{line.slice(2)}
					</li>
				)
			if (line.match(/^\d+\.\s/))
				return (
					<li key={index} className="ml-4 text-sm">
						{line.replace(/^\d+\.\s/, '')}
					</li>
				)
			if (!line.trim()) return <div key={index} className="h-2" />
			return (
				<p key={index} className="text-sm leading-relaxed">
					{line}
				</p>
			)
		})
	}

	const chunks: SummaryChunk[] = meeting.summaries

	return (
		<div className="h-full overflow-y-auto p-4">
			{chunks.length === 0 ? (
				<div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
					<Sparkles className="mb-3 h-10 w-10 opacity-50" />
					<p>总结将在录制一段时间后自动生成</p>
					<p className="mt-1 text-xs">请确保已在设置中配置 Kimi API Key</p>
				</div>
			) : (
				<div className="space-y-6">
					{chunks.map((chunk) => (
						<div key={chunk.id} className="rounded-xl border border-border bg-card p-4">
							<div className="mb-2 flex items-center justify-between">
								<div className="flex flex-wrap gap-1.5">
									{chunk.topics.map((topic) => (
										<span
											key={topic}
											className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
										>
											{topic}
										</span>
									))}
								</div>
								<span className="text-xs text-muted-foreground">
									{formatTime(chunk.startTime)} - {formatTime(chunk.endTime)}
								</span>
							</div>
							<div className="space-y-1 text-foreground">{renderMarkdown(chunk.content)}</div>
						</div>
					))}
				</div>
			)}
		</div>
	)
}
