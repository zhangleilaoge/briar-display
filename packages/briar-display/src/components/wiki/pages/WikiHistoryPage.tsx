'use client'

import { wikiApi } from '@/api/wiki'
import WikiTabs from '@/components/wiki/layout/WikiTabs'
import { cn } from '@/lib/utils'
import type { WikiDiffLine, WikiDiffResult, WikiRevision } from '@briar/shared'
import {
	ArrowLeftRight,
	ChevronDown,
	ChevronUp,
	Clock,
	GitCompare,
	Loader2,
	RotateCcw,
	Table,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

interface WikiHistoryPageProps {
	slug: string
}

type DiffViewMode = 'inline' | 'side-by-side'

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
		<div className="overflow-x-auto rounded-md border border-border">
			<table className="w-full border-collapse font-mono text-xs">
				<tbody>
					{diff.lines.map((line, i) => (
						<tr
							key={i}
							className={cn(
								line.type === 'added' && 'bg-green-50',
								line.type === 'removed' && 'bg-red-50',
								line.type === 'unchanged' && 'bg-white',
							)}
						>
							<td className="w-10 select-none border-r border-border px-2 py-0.5 text-right text-muted-foreground">
								{line.oldLineNum ?? ''}
							</td>
							<td className="w-10 select-none border-r border-border px-2 py-0.5 text-right text-muted-foreground">
								{line.newLineNum ?? ''}
							</td>
							<td className="w-5 select-none px-1 py-0.5 text-center">
								{line.type === 'added' && <span className="font-bold text-green-600">+</span>}
								{line.type === 'removed' && <span className="font-bold text-red-600">-</span>}
							</td>
							<td className="whitespace-pre-wrap px-3 py-0.5">{line.content}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	)
}

/** Side-by-side diff view */
function SideBySideDiffView({ diff }: { diff: WikiDiffResult }) {
	// Separate lines into old and new columns
	const oldLines: WikiDiffLine[] = []
	const newLines: WikiDiffLine[] = []

	for (const line of diff.lines) {
		if (line.type === 'unchanged') {
			oldLines.push(line)
			newLines.push(line)
		} else if (line.type === 'removed') {
			oldLines.push(line)
			newLines.push({ type: 'unchanged', content: '' })
		} else if (line.type === 'added') {
			oldLines.push({ type: 'unchanged', content: '' })
			newLines.push(line)
		}
	}

	return (
		<div className="overflow-x-auto rounded-md border border-border">
			<table className="w-full border-collapse font-mono text-xs">
				<thead>
					<tr className="bg-gray-50">
						<th className="w-10 border-r border-b border-border px-2 py-1.5 text-right text-muted-foreground">
							旧
						</th>
						<th className="w-1/2 border-r border-b border-border px-3 py-1.5 text-left">旧版本</th>
						<th className="w-10 border-r border-b border-border px-2 py-1.5 text-right text-muted-foreground">
							新
						</th>
						<th className="w-1/2 border-b border-border px-3 py-1.5 text-left">新版本</th>
					</tr>
				</thead>
				<tbody>
					{oldLines.map((oldLine, i) => {
						const newLine = newLines[i]
						return (
							<tr key={i}>
								<td className="select-none border-r border-border px-2 py-0.5 text-right text-muted-foreground">
									{oldLine.oldLineNum ?? ''}
								</td>
								<td
									className={cn(
										'whitespace-pre-wrap border-r border-border px-3 py-0.5',
										oldLine.type === 'removed' && 'bg-red-50',
									)}
								>
									{oldLine.type === 'removed' && (
										<span className="mr-1 font-bold text-red-600">-</span>
									)}
									{oldLine.content}
								</td>
								<td className="select-none border-r border-border px-2 py-0.5 text-right text-muted-foreground">
									{newLine.newLineNum ?? ''}
								</td>
								<td
									className={cn(
										'whitespace-pre-wrap px-3 py-0.5',
										newLine.type === 'added' && 'bg-green-50',
									)}
								>
									{newLine.type === 'added' && (
										<span className="mr-1 font-bold text-green-600">+</span>
									)}
									{newLine.content}
								</td>
							</tr>
						)
					})}
				</tbody>
			</table>
		</div>
	)
}

export default function WikiHistoryPage({ slug }: WikiHistoryPageProps) {
	const [revisions, setRevisions] = useState<WikiRevision[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [selectedRevs, setSelectedRevs] = useState<Set<string>>(new Set())
	const [diff, setDiff] = useState<WikiDiffResult | null>(null)
	const [diffLoading, setDiffLoading] = useState(false)
	const [diffError, setDiffError] = useState<string | null>(null)
	const [diffViewMode, setDiffViewMode] = useState<DiffViewMode>('inline')
	const [reverting, setReverting] = useState<string | null>(null)
	const [expandedRev, setExpandedRev] = useState<string | null>(null)

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

	// Toggle revision selection (max 2)
	const toggleRevSelection = useCallback((revId: string) => {
		setSelectedRevs((prev) => {
			const next = new Set(prev)
			if (next.has(revId)) {
				next.delete(revId)
			} else if (next.size < 2) {
				next.add(revId)
			} else {
				// Replace the oldest selection
				const arr = Array.from(next)
				next.delete(arr[0])
				next.add(revId)
			}
			return next
		})
		setDiff(null)
		setDiffError(null)
	}, [])

	// Compare selected revisions
	const handleCompare = useCallback(async () => {
		const ids = Array.from(selectedRevs)
		if (ids.length !== 2) return

		const rev1 = revisions.find((r) => r.id === ids[0])
		const rev2 = revisions.find((r) => r.id === ids[1])
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
	}, [selectedRevs, revisions, slug])

	// Revert to revision
	const handleRevert = useCallback(
		async (revId: string) => {
			if (!window.confirm('确定要回退到此版本吗？当前内容将被替换。')) return

			setReverting(revId)
			try {
				const res = await wikiApi.revertToRevision(slug, revId)
				if (res.success) {
					// Reload page
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
				<WikiTabs slug={slug} activeTab="history" />
				<div className="flex items-center justify-center py-20">
					<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
					<span className="ml-2 text-muted-foreground">加载版本历史...</span>
				</div>
			</div>
		)
	}

	if (error) {
		return (
			<div className="space-y-4">
				<WikiTabs slug={slug} activeTab="history" />
				<div className="py-12 text-center text-muted-foreground">{error}</div>
			</div>
		)
	}

	const selectedArr = Array.from(selectedRevs)

	return (
		<div className="space-y-4">
			<WikiTabs slug={slug} activeTab="history" />

			<h1 className="border-b border-border pb-3 font-serif text-xl font-normal text-foreground">
				版本历史: {slug}
			</h1>

			{/* Compare controls */}
			<div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-gray-50 px-4 py-3">
				<GitCompare className="h-4 w-4 text-muted-foreground" />
				<span className="text-sm text-foreground">已选择 {selectedArr.length}/2 个版本</span>
				<button
					type="button"
					onClick={handleCompare}
					disabled={selectedArr.length !== 2 || diffLoading}
					className={cn(
						'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors',
						selectedArr.length === 2
							? 'bg-primary text-primary-foreground hover:bg-primary/90'
							: 'cursor-not-allowed bg-muted text-muted-foreground',
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
				<table className="w-full text-sm">
					<thead>
						<tr className="border-b border-border bg-gray-50 text-left">
							<th className="w-10 px-3 py-2">
								<span className="sr-only">选择</span>
							</th>
							<th className="px-3 py-2 font-medium text-muted-foreground">版本</th>
							<th className="px-3 py-2 font-medium text-muted-foreground">时间</th>
							<th className="px-3 py-2 font-medium text-muted-foreground">编辑者</th>
							<th className="px-3 py-2 font-medium text-muted-foreground">大小变化</th>
							<th className="px-3 py-2 font-medium text-muted-foreground">摘要</th>
							<th className="w-24 px-3 py-2">
								<span className="sr-only">操作</span>
							</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-border">
						{revisions.map((rev) => {
							const isSelected = selectedRevs.has(rev.id)
							const isExpanded = expandedRev === rev.id
							return (
								<tr
									key={rev.id}
									className={cn(
										'transition-colors',
										isSelected ? 'bg-blue-50' : 'hover:bg-gray-50',
									)}
								>
									<td className="px-3 py-2.5">
										<input
											type="checkbox"
											checked={isSelected}
											onChange={() => toggleRevSelection(rev.id)}
											className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
										/>
									</td>
									<td className="px-3 py-2.5">
										<button
											type="button"
											onClick={() => setExpandedRev(isExpanded ? null : rev.id)}
											className="inline-flex items-center gap-1 font-mono text-blue-600 hover:text-blue-800"
										>
											v{rev.revisionNumber}
											{isExpanded ? (
												<ChevronUp className="h-3 w-3" />
											) : (
												<ChevronDown className="h-3 w-3" />
											)}
										</button>
										{rev.minorEdit && (
											<span className="ml-1.5 rounded bg-amber-100 px-1 py-0.5 text-[10px] text-amber-700">
												小
											</span>
										)}
									</td>
									<td className="px-3 py-2.5 text-muted-foreground">
										<div className="flex items-center gap-1">
											<Clock className="h-3.5 w-3.5" />
											{formatDate(rev.createdAt)}
										</div>
									</td>
									<td className="px-3 py-2.5 text-foreground">{rev.editorId}</td>
									<td className="px-3 py-2.5">
										<span
											className={cn(
												'font-mono',
												rev.sizeAfter - rev.sizeBefore > 0
													? 'text-green-600'
													: rev.sizeAfter - rev.sizeBefore < 0
														? 'text-red-600'
														: 'text-muted-foreground',
											)}
										>
											{formatSizeChange(rev.sizeBefore, rev.sizeAfter)} 字节
										</span>
									</td>
									<td className="max-w-[200px] truncate px-3 py-2.5 text-muted-foreground">
										{rev.summary || '—'}
									</td>
									<td className="px-3 py-2.5">
										<button
											type="button"
											onClick={() => handleRevert(rev.id)}
											disabled={reverting === rev.id}
											className="inline-flex items-center gap-1 text-xs text-amber-600 transition-colors hover:text-amber-800 disabled:opacity-50"
											title="回退到此版本"
										>
											{reverting === rev.id ? (
												<Loader2 className="h-3.5 w-3.5 animate-spin" />
											) : (
												<RotateCcw className="h-3.5 w-3.5" />
											)}
											回退
										</button>
									</td>
								</tr>
							)
						})}
					</tbody>
				</table>
			</div>

			{/* Expanded revision content */}
			{expandedRev &&
				(() => {
					const rev = revisions.find((r) => r.id === expandedRev)
					if (!rev) return null
					return (
						<div className="rounded-md border border-border bg-white p-4">
							<h3 className="mb-2 text-sm font-medium text-foreground">
								版本 v{rev.revisionNumber} 内容
							</h3>
							<pre className="max-h-[300px] overflow-auto whitespace-pre-wrap rounded bg-gray-50 p-3 font-mono text-xs text-foreground">
								{rev.content}
							</pre>
						</div>
					)
				})()}

			{/* Diff view */}
			{diffError && (
				<div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{diffError}
				</div>
			)}

			{diff && (
				<div className="space-y-3">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
							<Table className="h-4 w-4" />
							差异: v{diff.fromRevision} → v{diff.toRevision}
							<span className="text-xs text-muted-foreground">
								(+{diff.additions} / -{diff.deletions})
							</span>
						</h3>
						<div className="flex items-center gap-1">
							<button
								type="button"
								onClick={() => setDiffViewMode('inline')}
								className={cn(
									'rounded-md px-3 py-1 text-xs transition-colors',
									diffViewMode === 'inline'
										? 'bg-primary text-primary-foreground'
										: 'border border-border hover:bg-muted',
								)}
							>
								内联
							</button>
							<button
								type="button"
								onClick={() => setDiffViewMode('side-by-side')}
								className={cn(
									'rounded-md px-3 py-1 text-xs transition-colors',
									diffViewMode === 'side-by-side'
										? 'bg-primary text-primary-foreground'
										: 'border border-border hover:bg-muted',
								)}
							>
								并排
							</button>
						</div>
					</div>

					{diffViewMode === 'inline' ? (
						<InlineDiffView diff={diff} />
					) : (
						<SideBySideDiffView diff={diff} />
					)}
				</div>
			)}
		</div>
	)
}
