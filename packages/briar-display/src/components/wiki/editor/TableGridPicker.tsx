'use client'

import { useState } from 'react'

interface TableGridPickerProps {
	onSelect: (rows: number, cols: number) => void
	maxRows?: number
	maxCols?: number
}

export default function TableGridPicker({
	onSelect,
	maxRows = 8,
	maxCols = 8,
}: TableGridPickerProps) {
	const [hoverRow, setHoverRow] = useState(0)
	const [hoverCol, setHoverCol] = useState(0)

	return (
		<div className="p-2">
			<p className="mb-2 text-[13px] font-medium text-wiki-text">
				{hoverRow > 0 && hoverCol > 0 ? `插入 ${hoverRow} × ${hoverCol} 表格` : '选择表格大小'}
			</p>
			<div
				className="inline-grid gap-0.5"
				style={{ gridTemplateColumns: `repeat(${maxCols}, 20px)` }}
				onMouseLeave={() => {
					setHoverRow(0)
					setHoverCol(0)
				}}
			>
				{Array.from({ length: maxRows * maxCols }).map((_, i) => {
					const r = Math.floor(i / maxCols)
					const c = i % maxCols
					return (
						<button
							key={`${r}-${c}`}
							type="button"
							className={`h-5 w-5 rounded-[2px] border transition-colors ${
								r < hoverRow && c < hoverCol
									? 'border-wiki-link bg-wiki-link/20'
									: 'border-wiki-border-light bg-wiki-bg hover:bg-wiki-bg-tertiary'
							}`}
							onMouseEnter={() => {
								setHoverRow(r + 1)
								setHoverCol(c + 1)
							}}
							onClick={() => onSelect(r + 1, c + 1)}
						/>
					)
				})}
			</div>
		</div>
	)
}
