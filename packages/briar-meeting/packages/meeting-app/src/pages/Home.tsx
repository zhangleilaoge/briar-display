import type { Meeting } from '@briar/meeting-sdk'
import { Calendar, Clock, FileText, Mic, Plus, Trash2 } from 'lucide-react'

interface HomeProps {
	meetings: Meeting[]
	onCreate: () => void
	onOpen: (id: string) => void
	onRefresh: () => void
}

export function Home({ meetings, onCreate, onOpen, onRefresh }: HomeProps) {
	const formatDuration = (createdAt: number, updatedAt: number) => {
		const diff = Math.max(0, updatedAt - createdAt)
		const minutes = Math.floor(diff / 60000)
		const seconds = Math.floor((diff % 60000) / 1000)
		return `${minutes}分${seconds.toString().padStart(2, '0')}秒`
	}

	const handleDelete = async (e: React.MouseEvent, id: string) => {
		e.stopPropagation()
		await window.electron?.removeMeeting(id)
		onRefresh()
	}

	return (
		<div className="min-h-screen bg-background p-8">
			<div className="mx-auto max-w-4xl">
				<div className="mb-8 flex items-center justify-between">
					<div>
						<h1 className="text-3xl font-bold tracking-tight">Briar Meeting</h1>
						<p className="text-muted-foreground mt-1">智能会议纪要助手</p>
					</div>
					<button
						onClick={onCreate}
						className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition"
					>
						<Plus className="h-4 w-4" />
						新建会议
					</button>
				</div>

				{meetings.length === 0 ? (
					<div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-16 text-center">
						<div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
							<Mic className="h-8 w-8 text-muted-foreground" />
						</div>
						<h3 className="text-lg font-semibold">还没有会议记录</h3>
						<p className="text-muted-foreground mt-2 mb-6 max-w-sm">
							点击右上角新建会议，一键开始录制并生成纪要。
						</p>
						<button
							onClick={onCreate}
							className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition"
						>
							<Plus className="h-4 w-4" />
							开始第一场会议
						</button>
					</div>
				) : (
					<div className="grid gap-4">
						{meetings.map((meeting) => (
							<div
								key={meeting.id}
								onClick={() => onOpen(meeting.id)}
								className="group cursor-pointer rounded-xl border border-border bg-card p-5 transition hover:border-primary/50 hover:shadow-sm"
							>
								<div className="flex items-start justify-between">
									<div className="flex-1">
										<h3 className="text-lg font-semibold">{meeting.title}</h3>
										<div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
											<span className="inline-flex items-center gap-1.5">
												<Calendar className="h-4 w-4" />
												{new Date(meeting.createdAt).toLocaleString('zh-CN')}
											</span>
											<span className="inline-flex items-center gap-1.5">
												<Clock className="h-4 w-4" />
												{formatDuration(meeting.createdAt, meeting.updatedAt)}
											</span>
											<span className="inline-flex items-center gap-1.5">
												<FileText className="h-4 w-4" />
												{meeting.segments.length} 条对话
											</span>
										</div>
									</div>
									<button
										onClick={(e) => handleDelete(e, meeting.id)}
										className="rounded-md p-2 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
										aria-label="删除"
									>
										<Trash2 className="h-4 w-4" />
									</button>
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	)
}
