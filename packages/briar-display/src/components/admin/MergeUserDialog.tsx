'use client'

import { getUsers, mergeUser } from '@/api/admin'
import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { AlertTriangle, Loader2, Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

export interface MergeCandidate {
	userId: string
	userName: string
	userEmail: string
}

interface Props {
	source: MergeCandidate | null
	onOpenChange: (open: boolean) => void
	onMerged: (summary: string) => void
}

/** 「合并到…」：选择目标用户 → 二次确认 → 事务合并（源用户被删除，不可撤销） */
export default function MergeUserDialog({ source, onOpenChange, onMerged }: Props) {
	const [keyword, setKeyword] = useState('')
	const [candidates, setCandidates] = useState<MergeCandidate[]>([])
	const [searching, setSearching] = useState(false)
	const [target, setTarget] = useState<MergeCandidate | null>(null)
	const [confirming, setConfirming] = useState(false)
	const [merging, setMerging] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

	useEffect(() => {
		if (!source) return
		setKeyword('')
		setTarget(null)
		setConfirming(false)
		setError(null)
	}, [source])

	useEffect(() => {
		if (!source) return
		if (debounceRef.current) clearTimeout(debounceRef.current)
		debounceRef.current = setTimeout(async () => {
			setSearching(true)
			try {
				const res = await getUsers({ keyword: keyword || undefined, page: 1, pageSize: 20 })
				if (res.success && res.data) {
					setCandidates(
						res.data.items
							.filter((u: MergeCandidate) => u.userId !== source.userId)
							.map((u: MergeCandidate) => ({
								userId: u.userId,
								userName: u.userName,
								userEmail: u.userEmail,
							})),
					)
				}
			} catch {
				setError('搜索用户失败')
			} finally {
				setSearching(false)
			}
		}, 250)
		return () => {
			if (debounceRef.current) clearTimeout(debounceRef.current)
		}
	}, [keyword, source])

	const handleMerge = async () => {
		if (!source || !target) return
		setMerging(true)
		setError(null)
		try {
			const res = await mergeUser(source.userId, target.userId)
			if (res.success && res.data) {
				const moved = Object.entries(res.data.moved)
					.filter(([, n]) => n > 0)
					.map(([table, n]) => `${table} ${n}`)
					.join('，')
				onMerged(
					`已将 ${source.userName}（${source.userEmail}）合并到 ${target.userName}（${target.userEmail}）${
						moved ? `；迁移：${moved}` : ''
					}`,
				)
				onOpenChange(false)
			} else {
				setError(res.message || '合并失败')
			}
		} catch (err) {
			const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
			setError(msg || '合并失败，已整体回滚')
		} finally {
			setMerging(false)
		}
	}

	return (
		<Dialog open={!!source} onOpenChange={(open) => !merging && onOpenChange(open)}>
			<DialogContent className="sm:max-w-lg" data-testid="merge-user-dialog">
				<DialogHeader>
					<DialogTitle>合并用户</DialogTitle>
					<DialogDescription>
						把 <b>{source?.userName}</b>（{source?.userEmail}
						）的登录方式、角色、文件、日志等全部迁到目标用户，然后删除该用户。
					</DialogDescription>
				</DialogHeader>

				{!confirming ? (
					<div className="space-y-3">
						<div className="relative">
							<Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								placeholder="搜索目标用户（用户名或邮箱）"
								value={keyword}
								onChange={(e) => setKeyword(e.target.value)}
								className="h-9 pl-8"
							/>
						</div>
						<div className="max-h-64 overflow-y-auto rounded-md border border-border">
							{searching && candidates.length === 0 ? (
								<p className="p-3 text-sm text-muted-foreground">搜索中…</p>
							) : candidates.length === 0 ? (
								<p className="p-3 text-sm text-muted-foreground">没有匹配的用户</p>
							) : (
								candidates.map((u) => (
									<button
										key={u.userId}
										type="button"
										onClick={() => setTarget(u)}
										className={`flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-accent ${
											target?.userId === u.userId ? 'bg-accent' : ''
										}`}
									>
										<span className="font-medium">{u.userName}</span>
										<span className="text-xs text-muted-foreground">{u.userEmail}</span>
									</button>
								))
							)}
						</div>
					</div>
				) : (
					<div className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
						<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
						<div>
							确认将 <b>{source?.userName}</b>（{source?.userEmail}）合并到{' '}
							<b>{target?.userName}</b>（{target?.userEmail}）？合并后源用户会被<b>删除</b>，其
							Google 等登录方式将登录到目标用户。此操作不可撤销。
						</div>
					</div>
				)}

				{error && <p className="text-sm text-destructive">{error}</p>}

				<DialogFooter>
					{!confirming ? (
						<>
							<Button variant="ghost" onClick={() => onOpenChange(false)}>
								取消
							</Button>
							<Button disabled={!target} onClick={() => setConfirming(true)}>
								下一步
							</Button>
						</>
					) : (
						<>
							<Button variant="ghost" disabled={merging} onClick={() => setConfirming(false)}>
								返回
							</Button>
							<Button
								variant="destructive"
								disabled={merging}
								onClick={handleMerge}
								className="gap-1"
							>
								{merging && <Loader2 className="h-3 w-3 animate-spin" />}
								确认合并
							</Button>
						</>
					)}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
