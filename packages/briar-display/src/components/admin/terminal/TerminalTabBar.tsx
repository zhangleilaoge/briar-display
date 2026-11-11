'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Maximize, Minimize, Pencil, Plus, RotateCcw, TerminalSquare, X } from 'lucide-react'
import type { ConnStatus, TerminalSession } from './TerminalTabs'

const STATUS_DOT: Record<ConnStatus, string> = {
	connecting: 'bg-amber-400 animate-pulse',
	connected: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.55)]',
	closed: 'bg-slate-500',
	error: 'bg-red-400',
}

export const CONN_STATUS_LABEL: Record<ConnStatus, string> = {
	connecting: '正在连接',
	connected: '已连接',
	closed: '已断开',
	error: '连接异常',
}

interface TerminalTabBarProps {
	sessions: readonly TerminalSession[]
	activeId: number | null
	isFullscreen: boolean
	onActivate: (id: number) => void
	onAdd: () => void
	onClose: (id: number) => void
	onRename: (id: number) => void
	onReconnect: () => void
	onToggleFullscreen: () => void
}

export default function TerminalTabBar({
	sessions,
	activeId,
	isFullscreen,
	onActivate,
	onAdd,
	onClose,
	onRename,
	onReconnect,
	onToggleFullscreen,
}: TerminalTabBarProps) {
	const activeSession = sessions.find((session) => session.id === activeId)

	return (
		<div className="flex min-h-12 items-center gap-2 border-b border-[var(--term-border)] bg-[#0a0e14] px-2 sm:px-3">
			<div className="hidden items-center gap-2 pr-1 text-[var(--term-dim)] md:flex">
				<TerminalSquare className="h-4 w-4" aria-hidden />
				<span className="font-mono text-[10px] uppercase tracking-[0.16em]">Sessions</span>
			</div>
			<div
				role="tablist"
				aria-label="SSH 会话"
				className="flex min-w-0 flex-1 items-stretch gap-1 self-stretch overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
			>
				{sessions.map((session) => {
					const active = session.id === activeId
					return (
						<div
							key={session.id}
							id={`terminal-tab-${session.id}`}
							role="tab"
							tabIndex={active ? 0 : -1}
							aria-selected={active}
							aria-label={`${session.name}，${CONN_STATUS_LABEL[session.status]}`}
							title={`${session.name} · 双击重命名`}
							onClick={() => onActivate(session.id)}
							onDoubleClick={() => onRename(session.id)}
							onKeyDown={(event) => {
								if (event.key === 'Enter' || event.key === ' ') {
									event.preventDefault()
									onActivate(session.id)
								}
							}}
							className={cn(
								'group flex min-w-36 max-w-56 flex-none cursor-pointer items-center gap-2 border-b-2 px-3 text-xs transition-colors',
								active
									? 'border-b-sky-400 bg-[var(--term-bg)] text-[var(--term-title)]'
									: 'border-b-transparent text-[var(--term-muted)] hover:bg-white/[0.04] hover:text-[var(--term-title)]',
							)}
						>
							<span
								className={cn('h-1.5 w-1.5 shrink-0 rounded-full', STATUS_DOT[session.status])}
							/>
							<span className="min-w-0 flex-1 truncate text-left font-medium">{session.name}</span>
							<Button
								type="button"
								variant="ghost"
								size="icon-sm"
								aria-label={`重命名${session.name}`}
								title="重命名"
								onClick={(event) => {
									event.stopPropagation()
									onRename(session.id)
								}}
								className={cn(
									'-mr-1 h-6 w-6 shrink-0 px-0 text-[var(--term-dim)] hover:bg-white/10 hover:text-sky-300',
									active
										? 'opacity-70 hover:opacity-100'
										: 'opacity-0 focus-visible:opacity-100 group-hover:opacity-70',
								)}
							>
								<Pencil className="h-3 w-3" />
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="icon-sm"
								aria-label={`关闭${session.name}`}
								title="关闭会话"
								onClick={(event) => {
									event.stopPropagation()
									onClose(session.id)
								}}
								className="-mr-1 h-6 w-6 shrink-0 px-0 text-[var(--term-dim)] hover:bg-white/10 hover:text-[var(--term-title)]"
							>
								<X className="h-3.5 w-3.5" />
							</Button>
						</div>
					)
				})}
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					aria-label="新建会话"
					title="新建会话"
					onClick={onAdd}
					className="my-auto h-8 w-8 flex-none px-0 text-[var(--term-muted)] hover:bg-white/10 hover:text-sky-300"
				>
					<Plus className="h-4 w-4" />
				</Button>
			</div>
			<div className="flex flex-none items-center gap-1.5 border-l border-[var(--term-border)] pl-2">
				{activeSession && (
					<Button
						variant="default"
						size="sm"
						aria-label="重新连接"
						className="h-8 gap-1.5 border-[var(--term-border)] bg-[var(--term-bg-raised)] px-2.5 text-xs text-[var(--term-muted)] shadow-none hover:bg-white/10 hover:text-[var(--term-title)]"
						onClick={onReconnect}
						disabled={activeSession.status === 'connecting'}
					>
						<RotateCcw className="h-3.5 w-3.5" />
						<span className="hidden sm:inline">重新连接</span>
					</Button>
				)}
				<Button
					variant="default"
					size="icon-sm"
					aria-label={isFullscreen ? '退出全屏' : '全屏'}
					title={isFullscreen ? '退出全屏' : '全屏'}
					onClick={onToggleFullscreen}
					className="h-8 w-8 border-[var(--term-border)] bg-[var(--term-bg-raised)] px-0 text-[var(--term-muted)] shadow-none hover:bg-white/10 hover:text-[var(--term-title)]"
				>
					{isFullscreen ? (
						<Minimize className="h-3.5 w-3.5" />
					) : (
						<Maximize className="h-3.5 w-3.5" />
					)}
				</Button>
			</div>
		</div>
	)
}
