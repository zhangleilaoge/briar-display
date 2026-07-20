'use client'

import { Button } from '@/components/ui/button'
import { FoldVertical, UnfoldVertical } from 'lucide-react'
import { Fragment } from 'react'
import type { DiffLine, DiffSegment } from './toolDiffUtils'

interface DiffViewProps {
	segments: DiffSegment[]
	expanded: Set<number>
	onToggle: (index: number) => void
}

// ─── 折叠/展开条（GitLab 风格） ───

function CollapseBar({
	count,
	index,
	isExpanded,
	onToggle,
}: {
	count: number
	index: number
	isExpanded: boolean
	onToggle: (index: number) => void
}) {
	return (
		<Button
			type="button"
			variant="ghost"
			onClick={() => onToggle(index)}
			className="h-auto w-full justify-center gap-2 rounded-none border-y border-dashed px-3 py-1.5 font-sans text-xs font-normal text-muted-foreground hover:bg-accent/70 hover:text-foreground"
		>
			{isExpanded ? (
				<FoldVertical className="h-3.5 w-3.5" />
			) : (
				<UnfoldVertical className="h-3.5 w-3.5" />
			)}
			{isExpanded ? `收起 ${count} 行相同内容` : `${count} 行相同内容未显示，点击展开`}
		</Button>
	)
}

// ─── 统一视图 ───

function UnifiedLine({ line }: { line: DiffLine }) {
	const bg =
		line.type === 'added'
			? 'bg-green-100/80 dark:bg-green-500/15'
			: line.type === 'removed'
				? 'bg-red-100/80 dark:bg-red-500/15'
				: ''
	const marker = line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ''
	const markerColor =
		line.type === 'added'
			? 'text-green-600 dark:text-green-400'
			: line.type === 'removed'
				? 'text-red-600 dark:text-red-400'
				: ''
	return (
		<div className={`flex whitespace-pre px-2 ${bg}`}>
			<span className="w-10 shrink-0 select-none pr-1 text-right text-muted-foreground/60">
				{line.leftNum ?? ''}
			</span>
			<span className="w-10 shrink-0 select-none pr-2 text-right text-muted-foreground/60">
				{line.rightNum ?? ''}
			</span>
			<span className={`w-4 shrink-0 select-none ${markerColor}`}>{marker}</span>
			<span className="flex-1">{line.text}</span>
		</div>
	)
}

export function UnifiedView({ segments, expanded, onToggle }: DiffViewProps) {
	return (
		<div className="h-full overflow-auto rounded-md border bg-muted/30 font-mono text-[13px] leading-6">
			{segments.map((seg, si) => {
				const isExpanded = expanded.has(si)
				if (seg.kind === 'collapsed' && !isExpanded) {
					return (
						<CollapseBar
							key={si}
							count={seg.lines.length}
							index={si}
							isExpanded={false}
							onToggle={onToggle}
						/>
					)
				}
				return (
					<Fragment key={si}>
						{seg.kind === 'collapsed' && (
							<CollapseBar count={seg.lines.length} index={si} isExpanded onToggle={onToggle} />
						)}
						{seg.lines.map((line, li) => (
							<UnifiedLine key={li} line={line} />
						))}
					</Fragment>
				)
			})}
		</div>
	)
}

// ─── 分屏视图 ───

interface SplitCell {
	num: number | null
	text: string
	type: 'normal' | 'added' | 'removed' | 'blank'
}

/** 将 hunk 内的行配对为左右两列：连续的删除/新增行逐行对齐 */
function pairSegmentLines(lines: DiffLine[]): [SplitCell, SplitCell][] {
	const rows: [SplitCell, SplitCell][] = []
	let i = 0
	while (i < lines.length) {
		const line = lines[i]
		if (line.type === 'normal') {
			rows.push([
				{ num: line.leftNum, text: line.text, type: 'normal' },
				{ num: line.rightNum, text: line.text, type: 'normal' },
			])
			i++
			continue
		}
		const removed: DiffLine[] = []
		const added: DiffLine[] = []
		while (i < lines.length && lines[i].type === 'removed') removed.push(lines[i++])
		while (i < lines.length && lines[i].type === 'added') added.push(lines[i++])
		const max = Math.max(removed.length, added.length)
		for (let j = 0; j < max; j++) {
			rows.push([
				j < removed.length
					? { num: removed[j].leftNum, text: removed[j].text, type: 'removed' }
					: { num: null, text: '', type: 'blank' },
				j < added.length
					? { num: added[j].rightNum, text: added[j].text, type: 'added' }
					: { num: null, text: '', type: 'blank' },
			])
		}
	}
	return rows
}

function SplitCellView({ cell, side }: { cell: SplitCell; side: 'left' | 'right' }) {
	const bg =
		cell.type === 'removed'
			? 'bg-red-100/80 dark:bg-red-500/15'
			: cell.type === 'added'
				? 'bg-green-100/80 dark:bg-green-500/15'
				: cell.type === 'blank'
					? 'bg-muted/50'
					: ''
	return (
		<td
			className={`w-1/2 whitespace-pre p-0 align-top ${side === 'right' ? 'border-l' : ''} ${bg}`}
		>
			<span className="inline-block w-10 select-none pr-2 text-right text-muted-foreground/60">
				{cell.num ?? ''}
			</span>
			{cell.text || '\u00A0'}
		</td>
	)
}

export function SplitView({ segments, expanded, onToggle }: DiffViewProps) {
	return (
		<div className="h-full overflow-auto rounded-md border bg-muted/30 font-mono text-[13px] leading-6">
			<table className="w-full border-collapse">
				<tbody>
					{segments.map((seg, si) => {
						const isExpanded = expanded.has(si)
						if (seg.kind === 'collapsed' && !isExpanded) {
							return (
								<tr key={si}>
									<td colSpan={2} className="p-0">
										<CollapseBar
											count={seg.lines.length}
											index={si}
											isExpanded={false}
											onToggle={onToggle}
										/>
									</td>
								</tr>
							)
						}
						return (
							<Fragment key={si}>
								{seg.kind === 'collapsed' && (
									<tr>
										<td colSpan={2} className="p-0">
											<CollapseBar
												count={seg.lines.length}
												index={si}
												isExpanded
												onToggle={onToggle}
											/>
										</td>
									</tr>
								)}
								{pairSegmentLines(seg.lines).map(([left, right], ri) => (
									<tr key={ri}>
										<SplitCellView cell={left} side="left" />
										<SplitCellView cell={right} side="right" />
									</tr>
								))}
							</Fragment>
						)
					})}
				</tbody>
			</table>
		</div>
	)
}
