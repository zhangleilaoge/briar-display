'use client'

import { getMessages, markAllMessagesRead, markMessageRead } from '@/api/messages'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { SiteMessage } from '@briar/shared'
import { format } from 'date-fns'
import { CheckCheck, ChevronLeft, ChevronRight, Loader2, Mail } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

const PAGE_SIZE = 10

function formatTime(value: string): string {
	try {
		return format(new Date(value), 'yyyy-MM-dd HH:mm')
	} catch {
		return value
	}
}

export default function MessagesPanel() {
	const [items, setItems] = useState<SiteMessage[]>([])
	const [total, setTotal] = useState(0)
	const [page, setPage] = useState(1)
	const [loading, setLoading] = useState(true)
	const [detail, setDetail] = useState<SiteMessage | null>(null)

	const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
	const unread = items.filter((m) => !m.readAt).length

	const load = useCallback(async (p: number) => {
		setLoading(true)
		try {
			const res = await getMessages(p, PAGE_SIZE)
			if (res.success && res.data) {
				setItems(res.data.items)
				setTotal(res.data.total)
			}
		} finally {
			setLoading(false)
		}
	}, [])

	useEffect(() => {
		load(page)
	}, [page, load])

	const openDetail = async (msg: SiteMessage) => {
		setDetail(msg)
		if (msg.readAt) return
		const readAt = new Date().toISOString()
		setItems((prev) => prev.map((m) => (m.id === msg.id ? { ...m, readAt } : m)))
		setDetail((prev) => (prev?.id === msg.id ? { ...prev, readAt } : prev))
		await markMessageRead(msg.id)
	}

	const handleReadAll = async () => {
		const res = await markAllMessagesRead()
		if (res.success) {
			const readAt = new Date().toISOString()
			setItems((prev) => prev.map((m) => ({ ...m, readAt: m.readAt ?? readAt })))
			toast.success('已全部标记为已读')
		} else {
			toast.error(res.message || '操作失败')
		}
	}

	return (
		<Card>
			<CardHeader className="flex-row items-center justify-between space-y-0">
				<div>
					<CardTitle className="flex items-center gap-2 text-base">
						<Mail className="h-4 w-4" />
						站内信
						{total > 0 && (
							<span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
								{total}
							</span>
						)}
					</CardTitle>
					<CardDescription>系统通知与消息</CardDescription>
				</div>
				<Button variant="outline" size="sm" className="gap-1.5" onClick={handleReadAll}>
					<CheckCheck className="h-3.5 w-3.5" />
					全部已读
				</Button>
			</CardHeader>
			<CardContent>
				{loading ? (
					<div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
						<Loader2 className="h-4 w-4 animate-spin" />
						加载中...
					</div>
				) : items.length === 0 ? (
					<p className="py-10 text-center text-sm text-muted-foreground">暂无消息</p>
				) : (
					<>
						<div className="divide-y rounded-md border">
							{items.map((msg) => (
								<button
									key={msg.id}
									type="button"
									onClick={() => openDetail(msg)}
									className="flex w-full flex-col gap-1 px-3 py-2.5 text-left transition-colors hover:bg-accent"
								>
									<div className="flex items-center gap-2">
										<span
											className={cn(
												'h-1.5 w-1.5 shrink-0 rounded-full',
												msg.readAt ? 'bg-transparent' : 'bg-red-500',
											)}
										/>
										<span
											className={cn(
												'flex-1 truncate text-sm',
												msg.readAt ? 'text-muted-foreground' : 'font-medium',
											)}
										>
											{msg.title}
										</span>
										<span className="shrink-0 text-[11px] text-muted-foreground">
											{formatTime(msg.createdAt)}
										</span>
									</div>
									<p className="line-clamp-1 pl-3.5 text-xs text-muted-foreground">{msg.content}</p>
								</button>
							))}
						</div>

						{totalPages > 1 && (
							<div className="mt-3 flex items-center justify-between">
								<Button
									variant="outline"
									size="sm"
									className="gap-1"
									disabled={page <= 1}
									onClick={() => setPage((p) => p - 1)}
								>
									<ChevronLeft className="h-3.5 w-3.5" />
									上一页
								</Button>
								<span className="text-xs text-muted-foreground">
									第 {page} / {totalPages} 页
								</span>
								<Button
									variant="outline"
									size="sm"
									className="gap-1"
									disabled={page >= totalPages}
									onClick={() => setPage((p) => p + 1)}
								>
									下一页
									<ChevronRight className="h-3.5 w-3.5" />
								</Button>
							</div>
						)}
					</>
				)}
			</CardContent>

			{/* 详情弹窗 */}
			<Dialog open={detail !== null} onOpenChange={(open) => !open && setDetail(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{detail?.title}</DialogTitle>
						<DialogDescription>{detail ? formatTime(detail.createdAt) : ''}</DialogDescription>
					</DialogHeader>
					<p className="whitespace-pre-wrap text-sm leading-relaxed">{detail?.content}</p>
				</DialogContent>
			</Dialog>
		</Card>
	)
}
