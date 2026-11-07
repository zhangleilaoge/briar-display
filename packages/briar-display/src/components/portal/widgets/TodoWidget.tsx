'use client'

import { type TodoItem, createTodo, deleteTodo, listTodos, updateTodo } from '@/api/todos'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { WidgetChrome } from '../WidgetChrome'
import type { WidgetSize } from '../widgetTypes'

function Notice({ title, detail }: { title: string; detail?: string }) {
	return (
		<div className="flex flex-1 flex-col items-center justify-center gap-1 text-center">
			<p className="text-sm font-medium text-foreground/80">{title}</p>
			{detail && (
				<p className="line-clamp-3 text-[11px] leading-snug text-muted-foreground">{detail}</p>
			)}
		</div>
	)
}

export function TodoWidget({
	editing,
	onRemove,
}: {
	size: WidgetSize
	editing?: boolean
	onRemove?: () => void
}) {
	const [items, setItems] = useState<TodoItem[] | null>(null)
	const [error, setError] = useState<'forbidden' | 'error' | null>(null)
	const [draft, setDraft] = useState('')
	const [busy, setBusy] = useState(false)

	const load = useCallback(async () => {
		try {
			const res = await listTodos()
			if (res.success && res.data) {
				setItems(res.data.items)
				setError(null)
			} else {
				setError('error')
				setItems([])
			}
		} catch (err) {
			const status = (err as { response?: { status?: number } })?.response?.status
			if (status === 401 || status === 403) setError('forbidden')
			else setError('error')
			setItems([])
		}
	}, [])

	useEffect(() => {
		load()
	}, [load])

	const add = async (e?: React.FormEvent) => {
		e?.preventDefault()
		const title = draft.trim()
		if (!title) return
		setBusy(true)
		try {
			const res = await createTodo(title)
			if (!res.success || !res.data) {
				toast(res.message || '添加失败')
				return
			}
			setDraft('')
			setItems((prev) => [
				...(prev ?? []).filter((t) => !t.done),
				res.data!,
				...(prev ?? []).filter((t) => t.done),
			])
			await load()
		} catch {
			toast('添加失败')
		} finally {
			setBusy(false)
		}
	}

	const toggle = async (item: TodoItem) => {
		try {
			const res = await updateTodo(item.id, { done: !item.done })
			if (!res.success) {
				toast(res.message || '更新失败')
				return
			}
			await load()
		} catch {
			toast('更新失败')
		}
	}

	const remove = async (item: TodoItem) => {
		try {
			const res = await deleteTodo(item.id)
			if (!res.success) {
				toast(res.message || '删除失败')
				return
			}
			setItems((prev) => (prev ?? []).filter((t) => t.id !== item.id))
		} catch {
			toast('删除失败')
		}
	}

	let body: React.ReactNode
	if (items === null && !error) {
		body = <Notice title="加载待办…" />
	} else if (error === 'forbidden') {
		body = <Notice title="仅管理员可见" detail="登录管理员账号后查看" />
	} else if (error === 'error') {
		body = <Notice title="读取失败" detail="请稍后重试" />
	} else {
		const list = items ?? []
		body = (
			<div
				className="flex min-h-0 flex-1 flex-col gap-1.5"
				onClick={(e) => e.stopPropagation()}
				onKeyDown={(e) => e.stopPropagation()}
				data-no-drag
			>
				<ul className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain pr-0.5">
					{list.length === 0 && (
						<li className="py-2 text-center text-[11px] text-muted-foreground">
							暂无待办，写一条吧
						</li>
					)}
					{list.map((item) => (
						<li key={item.id} className="group/todo flex items-start gap-1.5">
							<Checkbox
								checked={item.done}
								onCheckedChange={() => toggle(item)}
								className="mt-0.5 h-3.5 w-3.5"
								aria-label={item.done ? '标为未完成' : '标为完成'}
							/>
							<span
								className={cn(
									'min-w-0 flex-1 text-[11px] leading-snug',
									item.done && 'text-muted-foreground line-through',
								)}
							>
								{item.title}
							</span>
							<button
								type="button"
								aria-label="删除待办"
								className="shrink-0 text-[10px] text-muted-foreground opacity-0 transition group-hover/todo:opacity-100 hover:text-[color:var(--rv-rose-deep)]"
								onClick={() => remove(item)}
							>
								×
							</button>
						</li>
					))}
				</ul>
				<form onSubmit={add} className="flex shrink-0 gap-1">
					<Input
						value={draft}
						onChange={(e) => setDraft(e.target.value)}
						placeholder="新待办…"
						className="h-7 px-2 text-xs"
						disabled={busy}
						maxLength={120}
					/>
					<button
						type="submit"
						disabled={busy || !draft.trim()}
						className="h-7 shrink-0 rounded-md border border-[color:var(--rv-navy)]/20 bg-[color-mix(in_srgb,var(--rv-pink)_55%,white)] px-2 text-[11px] font-medium text-foreground disabled:opacity-50"
					>
						加
					</button>
				</form>
			</div>
		)
	}

	return (
		<WidgetChrome
			title="待办"
			caption="À faire"
			editing={editing}
			onRemove={onRemove}
			bodyClassName="flex flex-col !pb-2.5 !pt-1.5"
			tilt={0.6}
		>
			{body}
		</WidgetChrome>
	)
}
