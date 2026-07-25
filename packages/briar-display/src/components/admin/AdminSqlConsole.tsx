'use client'

import { apiClient } from '@/api/request'
import AdminLayout from '@/components/admin/AdminLayout'
import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { useRequirePermission } from '@/hooks/useRequirePermission'
import { cn } from '@/lib/utils'
import { sql } from '@codemirror/lang-sql'
import CodeMirror from '@uiw/react-codemirror'
import {
	ChevronDown,
	ChevronRight,
	Clock,
	Database,
	History,
	Play,
	Shield,
	Table2,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

// ==================== 类型 ====================

interface SchemaColumn {
	name: string
	type: string
	nullable: boolean
	key: string | null
	comment: string | null
	default: string | null
}

interface SchemaTable {
	name: string
	comment: string | null
	rowCount: number
	dataSize: number
	columns: SchemaColumn[]
}

interface QueryResult {
	type: 'query' | 'execute'
	columns?: { name: string; type: number }[]
	rows?: Record<string, any>[]
	totalRows?: number
	truncated?: boolean
	affectedRows?: number
	insertId?: number | null
	durationMs: number
}

interface HistoryItem {
	id: string
	user_name: string
	sql_text: string
	sql_type: string
	status: string
	affected_rows: number | null
	row_count: number | null
	duration_ms: number | null
	error_message: string | null
	created_at: string
}

// ==================== 组件 ====================

export default function AdminSqlConsole() {
	const { loading, denied } = useRequirePermission('page:sql-console')

	if (loading) {
		return (
			<AdminLayout currentPath="/briar-display/admin/sql">
				<div className="flex h-64 items-center justify-center text-muted-foreground">加载中...</div>
			</AdminLayout>
		)
	}

	if (denied) {
		return (
			<AdminLayout currentPath="/briar-display/admin/sql">
				<div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
					<Shield className="h-8 w-8" />
					<p>无权访问 SQL 控制台</p>
				</div>
			</AdminLayout>
		)
	}

	return (
		<AdminLayout currentPath="/briar-display/admin/sql">
			<SqlConsoleContent />
		</AdminLayout>
	)
}

function SqlConsoleContent() {
	const [sqlText, setSqlText] = useState('')
	const [readOnly, setReadOnly] = useState(true)
	const [executing, setExecuting] = useState(false)
	const [result, setResult] = useState<QueryResult | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [activeTab, setActiveTab] = useState<'result' | 'schema' | 'history'>('result')

	// Schema
	const [schema, setSchema] = useState<SchemaTable[]>([])
	const [schemaLoading, setSchemaLoading] = useState(false)
	const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set())

	// History
	const [history, setHistory] = useState<HistoryItem[]>([])
	const [historyLoading, setHistoryLoading] = useState(false)

	const [confirmOpen, setConfirmOpen] = useState(false)
	const [pendingSql, setPendingSql] = useState('')

	const editorRef = useRef<any>(null)

	// 加载 Schema
	const loadSchema = useCallback(async () => {
		setSchemaLoading(true)
		try {
			const res = await apiClient.get('/admin/sql/schema')
			if (res.data.success) {
				setSchema(res.data.data)
			}
		} catch {
			// 静默失败
		} finally {
			setSchemaLoading(false)
		}
	}, [])

	// 加载历史
	const loadHistory = useCallback(async () => {
		setHistoryLoading(true)
		try {
			const res = await apiClient.get('/admin/sql/history?pageSize=30')
			if (res.data.success) {
				setHistory(res.data.data.items)
			}
		} catch {
			// 静默失败
		} finally {
			setHistoryLoading(false)
		}
	}, [])

	useEffect(() => {
		loadSchema()
	}, [loadSchema])

	// 实际执行逻辑
	const doExecute = useCallback(
		async (trimmed: string) => {
			setExecuting(true)
			setError(null)
			setResult(null)
			setActiveTab('result')

			try {
				const res = await apiClient.post('/admin/sql/execute', { sql: trimmed, readOnly })
				if (res.data.success) {
					setResult(res.data.data)
					if (res.data.data.type === 'execute') {
						toast.success(
							`执行成功，影响 ${res.data.data.affectedRows} 行（${res.data.data.durationMs}ms）`,
						)
					}
				} else {
					setError(res.data.message)
				}
			} catch (err: any) {
				setError(err?.response?.data?.message || '执行失败')
			} finally {
				setExecuting(false)
			}
		},
		[readOnly],
	)

	// 执行 SQL（写操作弹确认框）
	const handleExecute = useCallback(async () => {
		const trimmed = sqlText.trim()
		if (!trimmed) {
			toast.error('请输入 SQL 语句')
			return
		}

		// 写操作二次确认
		const upperSql = trimmed.toUpperCase()
		if (
			!readOnly &&
			!upperSql.startsWith('SELECT') &&
			!upperSql.startsWith('SHOW') &&
			!upperSql.startsWith('DESCRIBE') &&
			!upperSql.startsWith('EXPLAIN')
		) {
			setPendingSql(trimmed)
			setConfirmOpen(true)
			return
		}

		await doExecute(trimmed)
	}, [sqlText, readOnly, doExecute])

	// 确认执行写操作
	const handleConfirmExecute = useCallback(async () => {
		setConfirmOpen(false)
		await doExecute(pendingSql)
		setPendingSql('')
	}, [pendingSql, doExecute])

	// 快捷键执行
	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
				e.preventDefault()
				handleExecute()
			}
		},
		[handleExecute],
	)

	// 切换表展开
	const toggleTable = (name: string) => {
		setExpandedTables((prev) => {
			const next = new Set(prev)
			if (next.has(name)) next.delete(name)
			else next.add(name)
			return next
		})
	}

	// 点击表名插入到编辑器
	const insertTableName = (name: string) => {
		setSqlText((prev) => (prev ? `${prev} ${name}` : name))
	}

	const statusColor = (status: string) => {
		switch (status) {
			case 'success':
				return 'text-green-600'
			case 'error':
				return 'text-red-600'
			case 'timeout':
				return 'text-amber-600'
			case 'blocked':
				return 'text-orange-600'
			default:
				return 'text-muted-foreground'
		}
	}

	return (
		<div className="flex flex-col gap-4" onKeyDown={handleKeyDown}>
			{/* 标题 */}
			<div className="flex items-center justify-between">
				<h1 className="flex items-center gap-2 text-lg font-semibold">
					<Database className="h-5 w-5" />
					SQL 控制台
				</h1>
				<div className="flex items-center gap-3">
					{/* 只读模式切换 */}
					<label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
						<input
							type="checkbox"
							checked={readOnly}
							onChange={(e) => setReadOnly(e.target.checked)}
							className="h-3.5 w-3.5 rounded border-gray-300"
						/>
						只读模式
					</label>
					<Button onClick={handleExecute} disabled={executing || !sqlText.trim()} size="sm">
						<Play className="mr-1.5 h-3.5 w-3.5" />
						{executing ? '执行中...' : '执行'}
						<span className="ml-1.5 text-[10px] opacity-60">⌘↵</span>
					</Button>
				</div>
			</div>

			<div className="flex gap-4">
				{/* 左侧：编辑器 + 结果 */}
				<div className="flex min-w-0 flex-1 flex-col gap-3">
					{/* 编辑器 */}
					<div className="overflow-hidden rounded-lg border">
						<CodeMirror
							ref={editorRef}
							value={sqlText}
							onChange={setSqlText}
							extensions={[sql()]}
							placeholder={
								readOnly
									? '输入 SQL 查询... (只读模式，仅支持 SELECT)'
									: '输入 SQL 语句... (读写模式)'
							}
							height="160px"
							basicSetup={{
								lineNumbers: true,
								foldGutter: false,
								dropCursor: false,
								allowMultipleSelections: false,
							}}
						/>
					</div>

					{/* Tab 切换 */}
					<div className="flex gap-1 border-b">
						{(
							[
								{ key: 'result', label: '执行结果', icon: Table2 },
								{ key: 'history', label: '执行历史', icon: History },
							] as const
						).map(({ key, label, icon: Icon }) => (
							<button
								key={key}
								type="button"
								onClick={() => {
									setActiveTab(key)
									if (key === 'history') loadHistory()
								}}
								className={cn(
									'flex items-center gap-1.5 border-b-2 px-3 py-1.5 text-sm transition-colors',
									activeTab === key
										? 'border-foreground font-medium'
										: 'border-transparent text-muted-foreground hover:text-foreground',
								)}
							>
								<Icon className="h-3.5 w-3.5" />
								{label}
							</button>
						))}
					</div>

					{/* 结果区域 */}
					{activeTab === 'result' && (
						<div className="min-h-[200px]">
							{error && (
								<div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
									{error}
								</div>
							)}
							{result && !error && <ResultView result={result} />}
							{!result && !error && (
								<div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
									执行 SQL 查看结果
								</div>
							)}
						</div>
					)}

					{/* 历史区域 */}
					{activeTab === 'history' && (
						<div className="min-h-[200px]">
							{historyLoading ? (
								<div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
									加载中...
								</div>
							) : history.length === 0 ? (
								<div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
									暂无执行记录
								</div>
							) : (
								<div className="max-h-[400px] overflow-auto rounded-md border">
									<table className="w-full text-xs">
										<thead className="sticky top-0 bg-muted">
											<tr>
												<th className="px-2 py-1.5 text-left font-medium">时间</th>
												<th className="px-2 py-1.5 text-left font-medium">用户</th>
												<th className="px-2 py-1.5 text-left font-medium">类型</th>
												<th className="px-2 py-1.5 text-left font-medium">状态</th>
												<th className="px-2 py-1.5 text-left font-medium">耗时</th>
												<th className="max-w-[300px] px-2 py-1.5 text-left font-medium">SQL</th>
											</tr>
										</thead>
										<tbody>
											{history.map((item) => (
												<tr key={item.id} className="border-t hover:bg-muted/50">
													<td className="whitespace-nowrap px-2 py-1.5 text-muted-foreground">
														{new Date(item.created_at).toLocaleString('zh-CN', { hour12: false })}
													</td>
													<td className="px-2 py-1.5">{item.user_name || '-'}</td>
													<td className="px-2 py-1.5">
														<span className="rounded bg-muted px-1 py-0.5 font-mono">
															{item.sql_type}
														</span>
													</td>
													<td className={cn('px-2 py-1.5 font-medium', statusColor(item.status))}>
														{item.status}
													</td>
													<td className="px-2 py-1.5 text-muted-foreground">
														{item.duration_ms != null ? `${item.duration_ms}ms` : '-'}
													</td>
													<td
														className="max-w-[300px] truncate px-2 py-1.5 font-mono text-muted-foreground"
														title={item.sql_text}
													>
														{item.sql_text}
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							)}
						</div>
					)}
				</div>

				{/* 右侧：Schema 面板 */}
				<div className="hidden w-[260px] shrink-0 flex-col rounded-lg border lg:flex">
					<div className="flex items-center gap-2 border-b px-3 py-2 text-sm font-medium">
						<Database className="h-3.5 w-3.5" />
						表结构
						{schemaLoading && (
							<Clock className="ml-auto h-3 w-3 animate-spin text-muted-foreground" />
						)}
					</div>
					<div className="flex-1 overflow-auto p-2">
						{schema.map((table) => (
							<div key={table.name} className="mb-0.5">
								<button
									type="button"
									className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs hover:bg-muted"
									onClick={() => toggleTable(table.name)}
								>
									{expandedTables.has(table.name) ? (
										<ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
									) : (
										<ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
									)}
									<span className="font-mono font-medium">{table.name}</span>
									<span className="ml-auto text-[10px] text-muted-foreground">
										{table.rowCount}
									</span>
								</button>
								{expandedTables.has(table.name) && (
									<div className="ml-5 border-l pl-2">
										{table.comment && (
											<p className="px-1 py-0.5 text-[10px] text-muted-foreground">
												{table.comment}
											</p>
										)}
										{table.columns.map((col) => (
											<button
												key={col.name}
												type="button"
												className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[11px] hover:bg-muted"
												onClick={() => insertTableName(col.name)}
												title={`${col.type}${col.nullable ? ' NULL' : ' NOT NULL'}${col.comment ? ` — ${col.comment}` : ''}`}
											>
												<span
													className={cn(
														'font-mono',
														col.key === 'PRI' && 'font-semibold text-amber-600',
													)}
												>
													{col.name}
												</span>
												<span className="ml-auto text-[10px] text-muted-foreground">
													{col.type}
												</span>
											</button>
										))}
									</div>
								)}
							</div>
						))}
						{schema.length === 0 && !schemaLoading && (
							<p className="px-2 py-4 text-center text-xs text-muted-foreground">暂无表信息</p>
						)}
					</div>
				</div>
			</div>

			{/* 写操作确认弹窗 */}
			<Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle>确认执行写操作</DialogTitle>
						<DialogDescription asChild>
							<div className="space-y-2">
								<p>即将执行以下写操作，此操作不可撤销：</p>
								<pre className="max-h-[120px] overflow-auto rounded-md bg-muted p-2 font-mono text-xs">
									{pendingSql.slice(0, 500)}
									{pendingSql.length > 500 ? '...' : ''}
								</pre>
							</div>
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setConfirmOpen(false)}>
							取消
						</Button>
						<Button variant="destructive" onClick={handleConfirmExecute}>
							确认执行
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	)
}

// ==================== 结果展示 ====================

function ResultView({ result }: { result: QueryResult }) {
	if (result.type === 'execute') {
		return (
			<div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
				执行成功 — 影响 {result.affectedRows} 行
				{result.insertId ? `，插入 ID: ${result.insertId}` : ''}
				<span className="ml-2 text-green-500">({result.durationMs}ms)</span>
			</div>
		)
	}

	const rows = result.rows || []
	const columns =
		result.columns?.map((c) => c.name) || (rows.length > 0 ? Object.keys(rows[0]) : [])

	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-center gap-2 text-xs text-muted-foreground">
				<span>{result.totalRows} 行</span>
				{result.truncated && <span className="text-amber-600">（已截断，最多显示 1000 行）</span>}
				<span>({result.durationMs}ms)</span>
			</div>
			{rows.length > 0 ? (
				<div className="max-h-[400px] overflow-auto rounded-md border">
					<table className="w-full text-xs">
						<thead className="sticky top-0 bg-muted">
							<tr>
								{columns.map((col) => (
									<th key={col} className="whitespace-nowrap px-2 py-1.5 text-left font-medium">
										{col}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{rows.map((row, i) => (
								<tr key={i} className="border-t hover:bg-muted/50">
									{columns.map((col) => (
										<td
											key={col}
											className="max-w-[250px] truncate px-2 py-1 font-mono"
											title={String(row[col] ?? '')}
										>
											{row[col] === null ? (
												<span className="italic text-muted-foreground">NULL</span>
											) : (
												String(row[col])
											)}
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			) : (
				<div className="flex h-[100px] items-center justify-center text-sm text-muted-foreground">
					空结果集
				</div>
			)}
		</div>
	)
}
