'use client'

import type { UserMergeLog } from '@/api/admin'
import { getMyMergeLogs } from '@/api/auth'
import { MergeLogDetail } from '@/components/admin/MergeLogsDialog'
import { RUN_STATUS_STYLE, formatRunTime } from '@/components/admin/RunHistoryDialog'
import { ProfileSheet, ProfileSheetHeader } from '@/components/profile/ProfileSheet'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, ChevronRight, GitMerge } from 'lucide-react'
import { useEffect, useState } from 'react'

/** 个人中心「账号合并记录」：与当前用户相关的合并（其它账号并入本账号）；没有记录时不显示 */
export default function MergeHistoryCard({ userId }: { userId?: string }) {
	const [items, setItems] = useState<UserMergeLog[]>([])
	const [expandedId, setExpandedId] = useState<string | null>(null)

	useEffect(() => {
		if (!userId) return
		getMyMergeLogs()
			.then((res) => {
				if (res.success && res.data) setItems(res.data.items)
			})
			.catch(() => undefined)
	}, [userId])

	if (items.length === 0) return null

	return (
		<ProfileSheet data-testid="merge-history-card">
			<ProfileSheetHeader
				icon={<GitMerge className="h-4 w-4" />}
				title="账号合并记录"
				description="其它账号并入本账号的记录，点击查看迁移明细"
			/>
			<div className="space-y-1">
				{items.map((log) => {
					const expanded = expandedId === log.id
					const style = RUN_STATUS_STYLE[log.status]
					const incoming = log.targetUserId === userId
					return (
						<div key={log.id} className="border-b border-border/40 last:border-0">
							<button
								type="button"
								onClick={() => setExpandedId(expanded ? null : log.id)}
								className="flex w-full items-center gap-2 py-2 text-left text-sm"
							>
								{expanded ? (
									<ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
								) : (
									<ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
								)}
								<span className="min-w-0 flex-1 truncate">
									{incoming
										? `${log.sourceName || '账号'}（${log.sourceEmail}）并入本账号`
										: `并入 ${log.targetName}（${log.targetEmail}）`}
								</span>
								<Badge variant="secondary" className={`text-[11px] ${style.className}`}>
									{style.label}
								</Badge>
								<span className="shrink-0 font-mono text-xs text-muted-foreground">
									{formatRunTime(log.startedAt)}
								</span>
							</button>
							{expanded && (
								<div className="pb-3 pl-6">
									<MergeLogDetail log={log} />
								</div>
							)}
						</div>
					)
				})}
			</div>
		</ProfileSheet>
	)
}
