'use client'

import { wikiApi } from '@/api/wiki'
import WikiBreadcrumbs from '@/components/wiki/common/WikiBreadcrumbs'
import WikiTabs from '@/components/wiki/layout/WikiTabs'
import { cn } from '@/lib/utils'
import type { WikiDiffLine, WikiDiffResult, WikiRevision } from '@briar/shared'
import { ArrowLeftRight, Clock, GitCompare, Loader2, RotateCcw, Table } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

interface WikiHistoryPageProps {
	slug: string
}

function formatDate(date: string | Date): string {
	const d = typeof date === 'string' ? new Date(date) : date
	return d.toLocaleString('zh-CN', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	})
}

function formatSizeChange(sizeBefore: number, sizeAfter: number): string {
	const diff = sizeAfter - sizeBefore
	if (diff > 0) return `+${diff}`
	return `${diff}`
}

/** Inline diff view */
function InlineDiffView({ diff }: { diff: WikiDiffResult }) {
	return (
		<div className="overflow-x-auto rounded-sm border border-wiki-border-light">
			<table className="w-full border-collapse font-mono text-[12px]">
				<tbody>
					{diff.lines.map((line, i) => (
						<tr
							key={i}
							className={cn(
								line.type === 'added' && 'bg-green-50',
								line.type === 'removed' && 'bg-red-50',
								line.type === 'unchanged' && 'bg-wiki-bg',
							)}
						>
							<td className="w-10 select-none border-r border-wiki-border-light px-2 py-0.5 text-right text-wiki-text-muted">
								{line.oldLineNum ?? ''}
							</td>
							<td className="w-10 select-none border-r border-wiki-border-light px-2 py-0.5 text-right text-wiki-text-muted">
								{line.newLineNum ?? ''}
							</td>
							<td className="w-5 select-none px-1 py-0.5 text-center">
								{line.type === 'added' && <span className="font-bold text-green-600">+</span>}
								{line.type === 'removed' && <span className="font-bold text-red-600">-</span>}
							</td>
							<td className="whitespace-pre-wrap px-3 py-0.5 text-wiki-text">{line.content}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	)
}

export default function WikiHistoryPage({ slug }: WikiHistoryPageProps) {
	const [revisions, setRevisions] = useState<WikiRevision[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [fromRev, setFromRev] = useState<string | null>(null)
	const [toRev, setToRev] = useState<string | null>(null)
	const [diff, setDiff] = useState<WikiDiffResult | null>(null)
	const [diffLoading, setDiffLoading] = useState(false)
	const [diffError, setDiffError] = useState<string | null>(null)
	const [reverting, setReverting] = useState<string | null>(null)

	// Fetch revisions
	useEffect(() => {
		let cancelled = false
		setLoading(true)

		wikiApi.getRevisions(slug).then((res) => {
			if (cancelled) return
			if (res.success && res.data) {
				setRevisions(res.data.items)
			} else {
				setError(res.message || '加载版本历史失败')
			}
			setLoading(false)
		})

		return () => {
			cancelled = true
		}
	}, [slug])

	// Compare selected revisions
	const handleCompare = useCallback(async () => {
		if (!fromRev || !toRev) return

		const rev1 = revisions.find((r) => r.id === fromRev)
		const rev2 = revisions.find((r) => r.id === toRev)
		if (!rev1 || !rev2) return

		const fromNum = Math.min(rev1.revisionNumber, rev2.revisionNumber)
		const toNum = Math.max(rev1.revisionNumber, rev2.revisionNumber)

		setDiffLoading(true)
		setDiffError(null)
		try {
			const res = await wikiApi.getDiff(slug, fromNum, toNum)
			if (res.success && res.data) {
				setDiff(res.data)
			} else {
				setDiffError(res.message || '获取差异失败')
			}
		} catch {
			setDiffError('获取差异时发生错误')
		} finally {
			setDiffLoading(false)
		}
	}, [fromRev, toRev, revisions, slug])

	// Revert to revision
	const handleRevert = useCallback(
		async (revId: string) => {
			if (!window.confirm('确定要回退到此版本吗？当前内容将被替换。')) return

			setReverting(revId)
			try {
				const res = await wikiApi.revertToRevision(slug, revId)
				if (res.success) {
					window.history.pushState({}, '', `/briar-display/wiki/${slug}`)
					window.dispatchEvent(new PopStateEvent('popstate'))
				} else {
					alert(res.message || '回退失败')
				}
			} catch {
				alert('回退时发生错误')
			} finally {
				setReverting(null)
			}
		},
		[slug],
	)

	if (loading) {
		return (
			<div className="space-y-4">
				<WikiBreadcrumbs
					items={[{ label: slug, href: `/briar-display/wiki/${slug}` }, { label: '历史' }]}
				/>
				<WikiTabs slug={slug} active="history" />
				<div className="flex items-center justify-center py-20">
					<Loader2 className="h-8 w-8 animate-spin text-wiki-text-muted" />
					<span className="ml-2 text-wiki-text-muted">加载版本历史...</span>
				</div>
			</div>
		)
	}

	if (error) {
		return (
			<div className="space-y-4">
				<WikiBreadcrumbs
					items={[{ label: slug, href: `/briar-display/wiki/${slug}` }, { label: '历史' }]}
				/>
				<WikiTabs slug={slug} active="history" />
				<div className="py-12 text-center text-wiki-text-muted">{error}</div>
			</div>
		)
	}

	return (
		<div className="space-y-4">
			<WikiBreadcrumbs
				items={[{ label: slug, href: `/briar-display/wiki/${slug}` }, { label: '历史' }]}
			/>
			<WikiTabs slug={slug} active="history" />

			<h1 className="border-b border-wiki-border-light pb-2 text-[1.5em] font-normal text-wiki-text">
				版本历史: {slug}
			</h1>

			{/* Compare controls */}
			<div className="flex flex-wrap items-center gap-3 rounded-sm border border-wiki-border-light bg-wiki-bg-secondary px-4 py-3">
				<GitCompare className="h-4 w-4 text-wiki-text-secondary" />
				<span className="text-[13px] text-wiki-text">选择两个版本进行比较（点击下方单选按钮）</span>
				<button
					type="button"
					onClick={handleCompare}
					disabled={!fromRev || !toRev || diffLoading}
					className={cn(
						'inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-[13px] transition-colors',
						fromRev && toRev
							? 'bg-wiki-link text-white hover:bg-wiki-link-hover'
							: 'cursor-not-allowed bg-wiki-bg-tertiary text-wiki-text-muted',
					)}
				>
					{diffLoading ? (
						<Loader2 className="h-3.5 w-3.5 animate-spin" />
					) : (
						<ArrowLeftRight className="h-3.5 w-3.5" />
					)}
					比较选中版本
				</button>
			</div>

			{/* Revision table */}
			<div className="overflow-x-auto">
				<table className="w-full text-[13px]">
					<thead>
						<tr className="border-b border-wiki-border-light bg-wiki-bg-secondary text-left">
							<th className="px-3 py-2 font-medium text-wiki-text-secondary">
								<span className="sr-only">选择</span>
							</th>
							<th className="px-3 py-2 font-medium text-wiki-text-secondary">版本</th>
							<th className="px-3 py-2 font-medium text-wiki-text-secondary">编辑者</th>
							<th className="px-3 py-2 font-medium text-wiki-text-secondary">日期</th>
							<th className="px-3 py-2 font-medium text-wiki-text-secondary">编辑摘要</th>
							<th className="px-3 py-2 font-medium text-wiki-text-secondary">大小变化</th>
							<th className="w-20 px-3 py-2">
								<span className="sr-only">操作</span>
							</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-wiki-border-light">
						{revisions.map((rev) => {
							const isFrom = fromRev === rev.id
							const isTo = toRev === rev.id
							const sizeDiff = rev.sizeAfter - rev.sizeBefore
							return (
								<tr
									key={rev.id}
									className={cn(
										'transition-colors',
										isFrom && 'bg-blue-50',
										isTo && 'bg-green-50',
										!isFrom && !isTo && 'hover:bg-wiki-bg-secondary',
									)}
								>
									<td className="px-3 py-2.5">
										<div className="flex items-center gap-1">
											<label className="flex items-center gap-1" title="起始版本">
												<input
													type="radio"
													name="from-rev"
													checked={isFrom}
													onChange={() => setFromRev(rev.id)}
													className="h-3.5 w-3.5 border-wiki-border text-wiki-link focus:ring-wiki-link"
												/>
												<span className="text-[10px] text-wiki-text-muted">旧</span>
											</label>
											<label className="flex items-center gap-1" title="目标版本">
												<input
													type="radio"
													name="to-rev"
													checked={isTo}
													onChange={() => setToRev(rev.id)}
													className="h-3.5 w-3.5 border-wiki-border text-wiki-link focus:ring-wiki-link"
												/>
												<span className="text-[10px] text-wiki-text-muted">新</span>
											</label>
										</div>
									</td>
									<td className="px-3 py-2.5">
										<span className="font-mono text-wiki-link">v{rev.revisionNumber}</span>
										{rev.minorEdit && (
											<span className="ml-1.5 rounded bg-wiki-highlight px-1 py-0.5 text-[10px] text-wiki-link-red">
												小
											</span>
										)}
									</td>
									<td className="px-3 py-2.5 text-wiki-text">{rev.editorId}</td>
									<td className="px-3 py-2.5 text-wiki-text-secondary">
										<div className="flex items-center gap-1">
											<Clock className="h-3.5 w-3.5" />
											{formatDate(rev.createdAt)}
										</div>
									</td>
									<td className="max-w-[200px] truncate px-3 py-2.5 text-wiki-text-secondary">
										{rev.summary || '—'}
									</td>
									<td className="px-3 py-2.5">
										<span
											className={cn(
												'font-mono',
												sizeDiff > 0
													? 'text-green-600'
													: sizeDiff < 0
														? 'text-red-600'
														: 'text-wiki-text-muted',
											)}
										>
											{formatSizeChange(rev.sizeBefore, rev.sizeAfter)} 字节
										</span>
									</td>
									<td className="px-3 py-2.5">
										<button
											type="button"
											onClick={() => handleRevert(rev.id)}
											disabled={reverting === rev.id}
											className="inline-flex items-center gap-1 text-[12px] text-wiki-link-red transition-colors hover:underline disabled:opacity-50"
											title="回滚到此版本"
										>
											{reverting === rev.id ? (
												<Loader2 className="h-3.5 w-3.5 animate-spin" />
											) : (
												<RotateCcw className="h-3.5 w-3.5" />
											)}
											回滚
										</button>
									</td>
								</tr>
							)
						})}
					</tbody>
				</table>
			</div>

			{/* Diff view */}
			{diffError && (
				<div className="rounded-sm border border-wiki-highlight bg-wiki-highlight px-4 py-3 text-[13px] text-wiki-link-red">
					{diffError}
				</div>
			)}

			{diff && (
				<div className="space-y-3">
					<h3 className="flex items-center gap-2 text-[14px] font-medium text-wiki-text">
						<Table className="h-4 w-4" />
						差异: v{diff.fromRevision} → v{diff.toRevision}
						<span className="text-[12px] text-wiki-text-muted">
							(+{diff.additions} / -{diff.deletions})
						</span>
					</h3>
					<InlineDiffView diff={diff} />
				</div>
			)}
		</div>
	)
}
