'use client'

import { getMessages, getUnreadCount, markAllMessagesRead, markMessageRead } from '@/api/messages'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { usePermissions } from '@/contexts/PermissionContext'
import { cn } from '@/lib/utils'
import type { SiteMessage } from '@briar/shared'
import { format } from 'date-fns'
import { Bell, CheckCheck } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

const POLL_INTERVAL = 60_000

interface NotificationBellProps {
	/** 主题：light 给 Portal/Files/Tools/Admin，wiki 给 Wiki 主题顶部 */
	variant?: 'light' | 'wiki'
}

function formatTime(value: string): string {
	try {
		return format(new Date(value), 'yyyy-MM-dd HH:mm')
	} catch {
		return value
	}
}

export default function NotificationBell({ variant = 'light' }: NotificationBellProps) {
	const { isLoggedIn } = usePermissions()
	const [open, setOpen] = useState(false)
	const [unread, setUnread] = useState(0)
	const [messages, setMessages] = useState<SiteMessage[]>([])
	const [loading, setLoading] = useState(false)
	const mounted = useRef(true)

	const refreshUnread = useCallback(async () => {
		try {
			const res = await getUnreadCount()
			if (mounted.current && res.success && res.data) {
				setUnread(res.data.count)
			}
		} catch {
			/* 网络异常静默，下轮轮询再试 */
		}
	}, [])

	const loadMessages = useCallback(async () => {
		setLoading(true)
		try {
			const res = await getMessages(1, 20)
			if (mounted.current && res.success && res.data) {
				setMessages(res.data.items)
			}
		} finally {
			if (mounted.current) setLoading(false)
		}
	}, [])

	useEffect(() => {
		mounted.current = true
		if (!isLoggedIn) return
		refreshUnread()
		const timer = setInterval(refreshUnread, POLL_INTERVAL)
		return () => {
			mounted.current = false
			clearInterval(timer)
		}
	}, [isLoggedIn, refreshUnread])

	const handleOpenChange = (next: boolean) => {
		setOpen(next)
		if (next) {
			loadMessages()
			refreshUnread()
		}
	}

	const handleRead = async (msg: SiteMessage) => {
		if (msg.readAt) return
		setMessages((prev) =>
			prev.map((m) => (m.id === msg.id ? { ...m, readAt: new Date().toISOString() } : m)),
		)
		setUnread((n) => Math.max(0, n - 1))
		await markMessageRead(msg.id)
	}

	const handleReadAll = async () => {
		if (unread === 0) return
		setMessages((prev) => prev.map((m) => ({ ...m, readAt: m.readAt ?? new Date().toISOString() })))
		setUnread(0)
		await markAllMessagesRead()
	}

	if (!isLoggedIn) return null

	const isLight = variant === 'light'

	return (
		<Popover open={open} onOpenChange={handleOpenChange}>
			<PopoverTrigger asChild>
				<button
					type="button"
					aria-label="站内信"
					className={cn(
						'relative inline-flex items-center justify-center rounded-md p-2 transition-colors',
						isLight
							? 'text-foreground hover:bg-accent'
							: 'text-wiki-text hover:bg-wiki-bg-tertiary',
					)}
				>
					<Bell className="h-4 w-4" />
					{unread > 0 && (
						<span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
							{unread > 99 ? '99+' : unread}
						</span>
					)}
				</button>
			</PopoverTrigger>
			<PopoverContent className="w-80 p-0" align="end" sideOffset={6}>
				<div
					className={cn(
						'flex items-center justify-between border-b px-3 py-2',
						isLight ? 'border-border' : 'border-wiki-border-light',
					)}
				>
					<span
						className={cn('text-sm font-medium', isLight ? 'text-foreground' : 'text-wiki-text')}
					>
						站内信{unread > 0 ? `（${unread} 条未读）` : ''}
					</span>
					<button
						type="button"
						onClick={handleReadAll}
						disabled={unread === 0}
						className={cn(
							'inline-flex items-center gap-1 text-xs transition-colors',
							unread === 0
								? 'cursor-not-allowed opacity-40'
								: isLight
									? 'text-primary hover:underline'
									: 'text-wiki-link hover:underline',
						)}
					>
						<CheckCheck className="h-3.5 w-3.5" />
						全部已读
					</button>
				</div>

				<div className="max-h-80 overflow-y-auto">
					{loading && messages.length === 0 ? (
						<p
							className={cn(
								'px-3 py-6 text-center text-xs',
								isLight ? 'text-muted-foreground' : 'text-wiki-text-muted',
							)}
						>
							加载中...
						</p>
					) : messages.length === 0 ? (
						<p
							className={cn(
								'px-3 py-6 text-center text-xs',
								isLight ? 'text-muted-foreground' : 'text-wiki-text-muted',
							)}
						>
							暂无消息
						</p>
					) : (
						messages.map((msg) => (
							<button
								key={msg.id}
								type="button"
								onClick={() => handleRead(msg)}
								className={cn(
									'flex w-full flex-col gap-1 border-b px-3 py-2.5 text-left transition-colors last:border-b-0',
									isLight
										? 'border-border hover:bg-accent'
										: 'border-wiki-border-light hover:bg-wiki-bg-tertiary',
								)}
							>
								<div className="flex items-center gap-2">
									{!msg.readAt && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />}
									<span
										className={cn(
											'flex-1 truncate text-[13px]',
											msg.readAt
												? isLight
													? 'text-muted-foreground'
													: 'text-wiki-text-muted'
												: isLight
													? 'font-medium text-foreground'
													: 'font-medium text-wiki-text',
										)}
									>
										{msg.title}
									</span>
									<span
										className={cn(
											'shrink-0 text-[11px]',
											isLight ? 'text-muted-foreground' : 'text-wiki-text-muted',
										)}
									>
										{formatTime(msg.createdAt)}
									</span>
								</div>
								<p
									className={cn(
										'line-clamp-2 text-xs',
										isLight ? 'text-muted-foreground' : 'text-wiki-text-secondary',
									)}
								>
									{msg.content}
								</p>
							</button>
						))
					)}
				</div>
			</PopoverContent>
		</Popover>
	)
}
