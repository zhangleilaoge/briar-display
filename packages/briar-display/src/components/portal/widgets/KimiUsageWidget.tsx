'use client'

import { getKimiUsage } from '@/api/kimi'
import { cn } from '@/lib/utils'
import { type KimiUsageResponse, type KimiUsageWindow, formatKimiResetIn } from '@briar/shared'
import { useCallback, useEffect, useState } from 'react'
import { WidgetChrome } from '../WidgetChrome'
import type { WidgetSize } from '../widgetTypes'

/** 前端轮询 3 分钟；后端自带 60s 缓存 */
const POLL_MS = 3 * 60_000
const CONSOLE_URL = 'https://www.kimi.com/code/console'

type State =
	| { kind: 'loading' }
	| { kind: 'forbidden' }
	| { kind: 'error'; message: string }
	| { kind: 'ok'; body: KimiUsageResponse }

function barTone(pct: number) {
	if (pct >= 90) return 'bg-[color:var(--rv-rose-deep)]'
	if (pct >= 70) return 'bg-[hsl(32_80%_52%)]'
	return 'bg-[color:var(--rv-navy)]'
}

function UsageRow({ label, w, now }: { label: string; w: KimiUsageWindow; now: number }) {
	const reset = formatKimiResetIn(w.resetAt, now)
	const abs = w.used != null && w.limit != null ? `${w.used}/${w.limit}` : null
	return (
		<div
			className="min-w-0"
			title={[abs && `已用 ${abs}`, reset && `${reset}后重置`].filter(Boolean).join(' · ')}
		>
			<div className="flex items-baseline justify-between gap-1.5 leading-tight">
				<span className="min-w-0 truncate text-[11px] text-muted-foreground">
					<span className="font-medium text-foreground/85">{label}</span>
					<span className="tabular-nums"> · {reset ? `${reset}后重置` : '重置未知'}</span>
				</span>
				<span className="shrink-0 font-display text-base font-semibold tabular-nums leading-none text-foreground">
					{w.usedPct}
					<span className="text-[10px] font-normal text-muted-foreground">%</span>
				</span>
			</div>
			<div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--rv-navy)_12%,transparent)]">
				<div
					className={cn('h-full rounded-full transition-[width] duration-500', barTone(w.usedPct))}
					style={{ width: `${Math.max(w.usedPct, 2)}%` }}
				/>
			</div>
		</div>
	)
}

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

export function KimiUsageWidget({
	editing,
	onRemove,
}: {
	size: WidgetSize
	editing?: boolean
	onRemove?: () => void
}) {
	const [state, setState] = useState<State>({ kind: 'loading' })
	const [now, setNow] = useState(() => Date.now())

	const load = useCallback(async () => {
		try {
			const res = await getKimiUsage()
			if (res.success && res.data) setState({ kind: 'ok', body: res.data })
			else setState({ kind: 'error', message: res.message || '读取失败' })
		} catch (err) {
			const status = (err as { response?: { status?: number } })?.response?.status
			if (status === 401 || status === 403) setState({ kind: 'forbidden' })
			else setState({ kind: 'error', message: '网络异常' })
		}
		setNow(Date.now())
	}, [])

	useEffect(() => {
		load()
		const id = window.setInterval(load, POLL_MS)
		const tick = window.setInterval(() => setNow(Date.now()), 30_000)
		return () => {
			clearInterval(id)
			clearInterval(tick)
		}
	}, [load])

	let body: React.ReactNode
	if (state.kind === 'loading') {
		body = <Notice title="加载用量…" />
	} else if (state.kind === 'forbidden') {
		body = <Notice title="仅管理员可见" detail="登录管理员账号后查看" />
	} else if (state.kind === 'error') {
		body = <Notice title="读取失败" detail={state.message} />
	} else if (!state.body.configured) {
		body = <Notice title="未配置" detail="服务器 .env 设置 BRIAR_KIMI_API_KEY" />
	} else if (!state.body.data) {
		body = <Notice title="读取失败" detail={state.body.error || '上游无数据'} />
	} else {
		const d = state.body.data
		const second = d.weekly
			? { label: '本周', w: d.weekly }
			: d.monthly
				? { label: '本月', w: d.monthly }
				: null
		const rows = [d.fiveHour && { label: '5 小时', w: d.fiveHour }, second].filter(
			(r): r is { label: string; w: KimiUsageWindow } => Boolean(r),
		)
		const content = (
			<div className="flex min-h-0 flex-1 flex-col gap-2.5 pt-1">
				{rows.length ? (
					rows.map((r) => <UsageRow key={r.label} label={r.label} w={r.w} now={now} />)
				) : (
					<Notice title="暂无用量数据" />
				)}
				<p className="mt-auto flex items-center justify-between gap-1 truncate text-[10px] text-muted-foreground">
					<span className="truncate">{d.membership ?? 'Kimi Code'}</span>
					{state.body.stale ? (
						<span className="text-[color:var(--rv-rose-deep)]" title={state.body.error}>
							旧数据
						</span>
					) : d.boosterYuan != null ? (
						<span className="tabular-nums">加油包 ¥{d.boosterYuan.toFixed(2)}</span>
					) : null}
				</p>
			</div>
		)
		body = editing ? (
			content
		) : (
			<a
				href={CONSOLE_URL}
				target="_blank"
				rel="noreferrer"
				draggable={false}
				className="flex min-h-0 flex-1 flex-col outline-none transition hover:opacity-90"
			>
				{content}
			</a>
		)
	}

	return (
		<WidgetChrome
			title="Kimi 用量"
			caption="Kimi Code"
			editing={editing}
			onRemove={onRemove}
			bodyClassName="flex flex-col !pt-1"
			tilt={-0.4}
		>
			{body}
		</WidgetChrome>
	)
}
