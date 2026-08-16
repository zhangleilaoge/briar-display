'use client'

import type { FileItem } from '@/api/files'
import { useEffect, useState } from 'react'

type CellValue = string | number | boolean | null
type SheetData = { name: string; rows: CellValue[][] }

/** 一次最多渲染的行数，避免大表撑爆 DOM */
const MAX_ROWS = 200

/** xlsx 在线预览：动态 import('xlsx')，仅打开表格文件时才加载 SheetJS chunk，不进主包 */
export default function ExcelPreview({ file }: { file: FileItem }) {
	const [sheets, setSheets] = useState<SheetData[] | null>(null)
	const [active, setActive] = useState(0)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		let cancelled = false
		;(async () => {
			try {
				const [XLSX, res] = await Promise.all([import('xlsx'), fetch(file.cdnUrl)])
				if (!res.ok) throw new Error(`HTTP ${res.status}`)
				const wb = XLSX.read(await res.arrayBuffer())
				const data: SheetData[] = wb.SheetNames.map((name) => ({
					name,
					rows: XLSX.utils.sheet_to_json<CellValue[]>(wb.Sheets[name], {
						header: 1,
						raw: false,
						defval: '',
					}),
				}))
				if (!cancelled) setSheets(data)
			} catch {
				if (!cancelled) setError('表格解析失败，请下载后查看')
			}
		})()
		return () => {
			cancelled = true
		}
	}, [file.cdnUrl])

	if (error) {
		return (
			<div className="rounded-lg bg-muted p-4 text-center text-sm text-muted-foreground">
				{error}
			</div>
		)
	}
	if (!sheets) {
		return (
			<div className="rounded-lg bg-muted p-4 text-center text-sm text-muted-foreground">
				加载中...
			</div>
		)
	}

	const sheet = sheets[active]
	const rows = sheet?.rows ?? []
	const truncated = rows.length > MAX_ROWS

	return (
		<div className="rounded-lg border">
			{sheets.length > 1 && (
				<div className="flex flex-wrap gap-1 border-b bg-muted/50 px-2 py-1.5">
					{sheets.map((s, i) => (
						<button
							key={s.name}
							type="button"
							onClick={() => setActive(i)}
							className={`rounded px-2 py-0.5 text-xs ${
								i === active
									? 'bg-background font-medium shadow-sm'
									: 'text-muted-foreground hover:text-foreground'
							}`}
						>
							{s.name}
						</button>
					))}
				</div>
			)}
			<div className="max-h-[50vh] overflow-auto">
				<table className="w-full border-collapse text-xs">
					<tbody>
						{rows.slice(0, MAX_ROWS).map((row, ri) => (
							// 表格行列无稳定 id，用索引作 key
							<tr key={ri} className="even:bg-muted/40">
								{row.map((cell, ci) => (
									<td key={ci} className="whitespace-nowrap border-b px-2 py-1 align-top">
										{cell === null ? '' : String(cell)}
									</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
				{rows.length === 0 && (
					<p className="p-4 text-center text-sm text-muted-foreground">空表格</p>
				)}
			</div>
			{truncated && (
				<p className="border-t px-3 py-1.5 text-xs text-muted-foreground">
					仅预览前 {MAX_ROWS} 行（共 {rows.length} 行），完整内容请下载查看
				</p>
			)}
		</div>
	)
}
