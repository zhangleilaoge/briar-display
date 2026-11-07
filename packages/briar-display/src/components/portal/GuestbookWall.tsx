'use client'

import {
	type GuestbookEntry,
	approveGuestbook,
	deleteGuestbook,
	listGuestbook,
	listGuestbookPending,
	rejectGuestbook,
	submitGuestbook,
} from '@/api/guestbook'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PaperSheet } from '@/components/ui/paper-sheet'
import { Textarea } from '@/components/ui/textarea'
import { usePermissions } from '@/contexts/PermissionContext'
import { cn } from '@/lib/utils'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

function formatWhen(value: string | Date): string {
	const d = typeof value === 'string' ? new Date(value) : value
	if (Number.isNaN(d.getTime())) return ''
	return d.toLocaleString('zh-CN', {
		timeZone: 'Asia/Shanghai',
		month: 'numeric',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	})
}

type Tab = 'wall' | 'pending'

export function GuestbookWall() {
	const { isAdmin, loading: permsLoading } = usePermissions()
	const [tab, setTab] = useState<Tab>('wall')
	const [items, setItems] = useState<GuestbookEntry[]>([])
	const [pending, setPending] = useState<GuestbookEntry[]>([])
	const [pendingTotal, setPendingTotal] = useState(0)
	const [loading, setLoading] = useState(true)
	const [nickname, setNickname] = useState('')
	const [content, setContent] = useState('')
	const [submitting, setSubmitting] = useState(false)

	const loadWall = useCallback(async () => {
		try {
			const res = await listGuestbook(1, 40)
			if (res.success && res.data) setItems(res.data.items)
		} catch {
			/* ignore public load blips */
		}
	}, [])

	const loadPending = useCallback(async () => {
		if (!isAdmin) {
			setPending([])
			setPendingTotal(0)
			return
		}
		try {
			const res = await listGuestbookPending(1, 40)
			if (res.success && res.data) {
				setPending(res.data.items)
				setPendingTotal(res.data.total)
			}
		} catch {
			setPending([])
			setPendingTotal(0)
		}
	}, [isAdmin])

	const refresh = useCallback(async () => {
		setLoading(true)
		await Promise.all([loadWall(), loadPending()])
		setLoading(false)
	}, [loadWall, loadPending])

	useEffect(() => {
		if (permsLoading) return
		refresh()
	}, [permsLoading, refresh])

	const onSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		const nick = nickname.trim()
		const body = content.trim()
		if (!nick || !body) {
			toast('请填写昵称和留言')
			return
		}
		setSubmitting(true)
		try {
			const res = await submitGuestbook(nick, body)
			if (!res.success) {
				toast(res.message || '提交失败')
				return
			}
			toast(res.message || '已提交，等待审核')
			setContent('')
			if (isAdmin) await loadPending()
		} catch (err) {
			const status = (err as { response?: { status?: number; data?: { message?: string } } })
				?.response
			toast(status?.data?.message || (status?.status === 429 ? '留言太频繁' : '提交失败'))
		} finally {
			setSubmitting(false)
		}
	}

	const approve = async (id: string) => {
		try {
			const res = await approveGuestbook(id)
			if (!res.success) {
				toast(res.message || '操作失败')
				return
			}
			toast('已通过')
			await refresh()
		} catch {
			toast('操作失败')
		}
	}

	const reject = async (id: string) => {
		try {
			const res = await rejectGuestbook(id)
			if (!res.success) {
				toast(res.message || '操作失败')
				return
			}
			toast('已拒绝')
			await refresh()
		} catch {
			toast('操作失败')
		}
	}

	const remove = async (id: string) => {
		try {
			const res = await deleteGuestbook(id)
			if (!res.success) {
				toast(res.message || '删除失败')
				return
			}
			toast('已下架')
			await refresh()
		} catch {
			toast('删除失败')
		}
	}

	const showPending = isAdmin && tab === 'pending'
	const display = showPending ? pending : items

	const emptyHint = useMemo(() => {
		if (loading) return '加载中…'
		if (showPending) return '暂无待审留言'
		return '还没有留言，来写第一条吧'
	}, [loading, showPending])

	return (
		<section aria-label="访客留言墙" className="space-y-4">
			<header className="flex flex-wrap items-end justify-between gap-3 px-1">
				<div>
					<p className="rv-label text-muted-foreground">Guestbook</p>
					<h2 className="font-heading text-xl font-semibold text-foreground sm:text-2xl">
						留言墙
						<span className="rv-script ml-2 text-base font-normal text-[color:var(--rv-rose-deep)]">
							livre d'or
						</span>
					</h2>
					<p className="mt-1 text-xs text-muted-foreground">
						匿名可留 · 审核通过后展示（手账便签墙）
					</p>
				</div>
				{isAdmin && (
					<div className="flex items-center gap-1 rounded-full border border-[color:var(--rv-navy)]/15 bg-[color-mix(in_srgb,var(--rv-cream)_88%,white)] p-0.5 text-xs">
						<button
							type="button"
							className={cn(
								'rounded-full px-3 py-1 transition',
								tab === 'wall' ? 'bg-[var(--rv-pink)] font-medium' : 'text-muted-foreground',
							)}
							onClick={() => setTab('wall')}
						>
							公开
						</button>
						<button
							type="button"
							className={cn(
								'rounded-full px-3 py-1 transition',
								tab === 'pending' ? 'bg-[var(--rv-pink)] font-medium' : 'text-muted-foreground',
							)}
							onClick={() => setTab('pending')}
						>
							待审{pendingTotal > 0 ? ` · ${pendingTotal}` : ''}
						</button>
					</div>
				)}
			</header>

			{/* Twikoo 风格：昵称 + 正文表单 */}
			<PaperSheet variant="torn" className="max-w-xl" bodyClassName="space-y-3">
				<form onSubmit={onSubmit} className="space-y-3">
					<div className="flex flex-col gap-2 sm:flex-row">
						<Input
							value={nickname}
							onChange={(e) => setNickname(e.target.value)}
							placeholder="昵称"
							maxLength={24}
							className="sm:max-w-[10rem]"
							disabled={submitting}
						/>
						<p className="hidden flex-1 items-center text-[11px] text-muted-foreground sm:flex">
							提交后需管理员审核才会出现在墙上
						</p>
					</div>
					<Textarea
						value={content}
						onChange={(e) => setContent(e.target.value)}
						placeholder="写点什么吧…（最多 500 字）"
						maxLength={500}
						rows={3}
						disabled={submitting}
						className="resize-none text-sm"
					/>
					<div className="flex items-center justify-between gap-2">
						<span className="text-[11px] text-muted-foreground">{content.trim().length}/500</span>
						<Button type="submit" size="sm" disabled={submitting}>
							{submitting ? '提交中…' : '留下足迹'}
						</Button>
					</div>
				</form>
			</PaperSheet>

			{display.length === 0 ? (
				<p className="py-6 text-center text-sm text-muted-foreground">{emptyHint}</p>
			) : (
				<div className="rv-stagger grid gap-4 sm:grid-cols-2">
					{display.map((entry) => {
						return (
							<PaperSheet
								key={entry.id}
								variant="ticket"
								className="transition hover:-translate-y-0.5"
								bodyClassName="space-y-2"
							>
								<div className="flex items-baseline justify-between gap-2">
									<p className="truncate font-heading text-sm font-semibold text-foreground">
										{entry.nickname}
									</p>
									<time className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
										{formatWhen(entry.createdAt)}
									</time>
								</div>
								<p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90">
									{entry.content}
								</p>
								{isAdmin && (
									<div className="flex flex-wrap gap-2 pt-1">
										{showPending ? (
											<>
												<button
													type="button"
													className="text-[11px] font-medium text-[color:var(--rv-navy)] underline-offset-2 hover:underline"
													onClick={() => approve(entry.id)}
												>
													通过
												</button>
												<button
													type="button"
													className="text-[11px] text-muted-foreground underline-offset-2 hover:text-[color:var(--rv-rose-deep)] hover:underline"
													onClick={() => reject(entry.id)}
												>
													拒绝
												</button>
											</>
										) : (
											<button
												type="button"
												className="text-[11px] text-muted-foreground underline-offset-2 hover:text-[color:var(--rv-rose-deep)] hover:underline"
												onClick={() => remove(entry.id)}
											>
												下架
											</button>
										)}
									</div>
								)}
							</PaperSheet>
						)
					})}
				</div>
			)}
		</section>
	)
}
