'use client'

import { getDeviceToken } from '@/api/terminal'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { NODE_PORT } from '@briar/shared'
import type { FitAddon } from '@xterm/addon-fit'
import type { Terminal } from '@xterm/xterm'
import { Loader2, Plus, TerminalSquare } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import '@xterm/xterm/css/xterm.css'
import RenameTerminalDialog from './RenameTerminalDialog'
import TerminalTabBar, { CONN_STATUS_LABEL } from './TerminalTabBar'
import { readTerminalTabNames, writeTerminalTabNames } from './terminalTabNames'

export type ConnStatus = 'connecting' | 'connected' | 'closed' | 'error'

export interface TerminalSession {
	id: number
	name: string
	status: ConnStatus
}

interface Instance {
	term: Terminal
	fit: FitAddon
	ws: WebSocket | null
}

type XtermLib = {
	Terminal: typeof Terminal
	FitAddon: typeof FitAddon
}

function buildWsUrl(cols: number, rows: number): string {
	const { protocol, hostname, host } = window.location
	const isLocal = hostname === 'localhost' || hostname === '127.0.0.1'
	const wsProtocol = protocol === 'https:' ? 'wss' : 'ws'
	const wsHost = isLocal ? `${hostname}:${NODE_PORT}` : host
	const token = window.localStorage.getItem('briar_token') || ''
	const device = getDeviceToken()
	return `${wsProtocol}://${wsHost}/api/terminal/ws?cols=${cols}&rows=${rows}&token=${encodeURIComponent(token)}&device=${encodeURIComponent(device)}`
}

/** 多标签 SSH 终端：每个 tab 独立 WS + SSH 连接，切换仅隐藏容器保持会话存活 */
export default function TerminalTabs() {
	const [sessions, setSessions] = useState<TerminalSession[]>([])
	const [activeId, setActiveId] = useState<number | null>(null)
	const [renamingId, setRenamingId] = useState<number | null>(null)
	const [savedNames] = useState<Record<string, string>>(() =>
		typeof window === 'undefined' ? {} : readTerminalTabNames(window.localStorage),
	)

	const nextIdRef = useRef(1)
	const libRef = useRef<XtermLib | null>(null)
	const instancesRef = useRef(new Map<number, Instance>())
	const containersRef = useRef(new Map<number, HTMLDivElement>())
	const cardRef = useRef<HTMLDivElement>(null)
	const [isFullscreen, setIsFullscreen] = useState(false)
	const [paneHeight, setPaneHeight] = useState(480)

	// 非全屏时终端高度自适应：最小 480，视口够高则填满剩余空间
	const updatePaneHeight = useCallback(() => {
		const el = cardRef.current
		if (!el || document.fullscreenElement) return
		const avail = window.innerHeight - el.getBoundingClientRect().top - 112 - 24
		setPaneHeight(Math.max(480, Math.floor(avail)))
	}, [])

	const setSessionStatus = useCallback((id: number, status: ConnStatus) => {
		setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)))
	}, [])

	// 全屏切换（Fullscreen API），状态变化后重新 fit 当前终端
	const toggleFullscreen = useCallback(() => {
		if (document.fullscreenElement) {
			void document.exitFullscreen()
		} else {
			void cardRef.current?.requestFullscreen()
		}
	}, [])

	useEffect(() => {
		const onFullscreenChange = () => {
			const fs = !!document.fullscreenElement
			setIsFullscreen(fs)
			// 等浏览器完成全屏布局后再 fit
			requestAnimationFrame(() => {
				if (activeId === null) return
				const inst = instancesRef.current.get(activeId)
				if (!inst) return
				inst.fit.fit()
				if (inst.ws?.readyState === WebSocket.OPEN) {
					inst.ws.send(
						JSON.stringify({ type: 'resize', cols: inst.term.cols, rows: inst.term.rows }),
					)
				}
				inst.term.focus()
			})
		}
		document.addEventListener('fullscreenchange', onFullscreenChange)
		return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
	}, [activeId])

	const connect = useCallback(
		(id: number) => {
			const inst = instancesRef.current.get(id)
			if (!inst) return
			const { term, fit } = inst

			inst.ws?.close()
			setSessionStatus(id, 'connecting')
			term.reset()
			fit.fit()

			const ws = new WebSocket(buildWsUrl(term.cols, term.rows))
			inst.ws = ws

			ws.onmessage = (event) => {
				let msg: { type: string; status?: ConnStatus; data?: string; message?: string }
				try {
					msg = JSON.parse(event.data)
				} catch {
					return
				}
				if (msg.type === 'data' && typeof msg.data === 'string') {
					term.write(msg.data)
				} else if (msg.type === 'status' && msg.status) {
					setSessionStatus(id, msg.status)
					if (msg.status === 'error' && msg.message) {
						term.writeln(`\r\n\x1b[31m连接失败: ${msg.message}\x1b[0m`)
					}
				}
			}
			ws.onclose = (event) => {
				setSessions((prev) =>
					prev.map((s) =>
						s.id === id && s.status !== 'error' ? { ...s, status: 'closed' as const } : s,
					),
				)
				const reason = event.reason === 'idle timeout' ? '空闲超时，' : ''
				term.writeln(`\r\n\x1b[33m${reason}连接已断开\x1b[0m`)
			}
			ws.onerror = () => setSessionStatus(id, 'error')
		},
		[setSessionStatus],
	)

	// 初始化会话的 xterm 实例（xterm 为 CJS 包，必须动态引入避免 Astro build 报错）
	const initSession = useCallback(
		async (id: number) => {
			if (instancesRef.current.has(id)) return
			if (!libRef.current) {
				const [xterm, fitAddon] = await Promise.all([
					import('@xterm/xterm'),
					import('@xterm/addon-fit'),
				])
				libRef.current = { Terminal: xterm.Terminal, FitAddon: fitAddon.FitAddon }
			}
			const container = containersRef.current.get(id)
			if (!container || instancesRef.current.has(id)) return

			const term = new libRef.current.Terminal({
				fontSize: 14,
				lineHeight: 1.25,
				fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
				cursorBlink: true,
				// 与 theme.css --term-* 保持一致（xterm 渲染在 canvas，读不到 CSS 变量）
				theme: {
					background: '#0d1117',
					foreground: '#d6dde8',
					cursor: '#7dd3fc',
					cursorAccent: '#0d1117',
					selectionBackground: '#264f78',
				},
			})
			const fit = new libRef.current.FitAddon()
			term.loadAddon(fit)
			term.open(container)

			const inst: Instance = { term, fit, ws: null }
			instancesRef.current.set(id, inst)

			term.onData((data) => {
				if (inst.ws?.readyState === WebSocket.OPEN) {
					inst.ws.send(JSON.stringify({ type: 'input', data }))
				}
			})

			connect(id)
		},
		[connect],
	)

	const addSession = useCallback(() => {
		const id = nextIdRef.current++
		setSessions((prev) => [
			...prev,
			{ id, name: savedNames[String(id)] ?? `终端 ${id}`, status: 'connecting' },
		])
		setActiveId(id)
	}, [savedNames])

	const closeSession = useCallback((id: number) => {
		const inst = instancesRef.current.get(id)
		inst?.ws?.close()
		inst?.term.dispose()
		instancesRef.current.delete(id)
		containersRef.current.delete(id)
		setSessions((prev) => {
			const next = prev.filter((s) => s.id !== id)
			setActiveId((active) => (active === id ? (next[next.length - 1]?.id ?? null) : active))
			return next
		})
		setRenamingId((current) => (current === id ? null : current))
	}, [])

	const renameSession = useCallback((id: number, name: string) => {
		setSessions((prev) =>
			prev.map((session) => (session.id === id ? { ...session, name } : session)),
		)
		const names = { ...readTerminalTabNames(window.localStorage), [String(id)]: name }
		if (!writeTerminalTabNames(window.localStorage, names)) {
			toast.error('名称已更新，但浏览器未能保存')
		}
	}, [])

	// 首个会话
	useEffect(() => {
		if (sessions.length === 0 && activeId === null) {
			addSession()
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	// 容器挂载后为缺少实例的会话初始化终端
	useEffect(() => {
		for (const s of sessions) {
			void initSession(s.id)
		}
	}, [sessions, initSession])

	// 切换 tab 后重新 fit 并同步尺寸
	useEffect(() => {
		if (activeId === null) return
		const inst = instancesRef.current.get(activeId)
		if (!inst) return
		inst.fit.fit()
		if (inst.ws?.readyState === WebSocket.OPEN) {
			inst.ws.send(JSON.stringify({ type: 'resize', cols: inst.term.cols, rows: inst.term.rows }))
		}
		inst.term.focus()
	}, [activeId])

	// 窗口尺寸变化时重算高度并 fit 当前会话
	useEffect(() => {
		const onResize = () => {
			updatePaneHeight()
			if (activeId === null) return
			const inst = instancesRef.current.get(activeId)
			if (!inst) return
			inst.fit.fit()
			if (inst.ws?.readyState === WebSocket.OPEN) {
				inst.ws.send(JSON.stringify({ type: 'resize', cols: inst.term.cols, rows: inst.term.rows }))
			}
		}
		updatePaneHeight()
		window.addEventListener('resize', onResize)
		return () => window.removeEventListener('resize', onResize)
	}, [activeId, updatePaneHeight])

	// 终端高度变化后等 DOM 更新再 fit
	useEffect(() => {
		if (activeId === null) return
		const inst = instancesRef.current.get(activeId)
		if (!inst) return
		requestAnimationFrame(() => {
			inst.fit.fit()
			if (inst.ws?.readyState === WebSocket.OPEN) {
				inst.ws.send(JSON.stringify({ type: 'resize', cols: inst.term.cols, rows: inst.term.rows }))
			}
		})
	}, [paneHeight, activeId])

	// 卸载时清理所有会话
	useEffect(() => {
		const instances = instancesRef.current
		return () => {
			for (const inst of instances.values()) {
				inst.ws?.close()
				inst.term.dispose()
			}
			instances.clear()
		}
	}, [])

	const registerContainer = useCallback((id: number, el: HTMLDivElement | null) => {
		if (el) containersRef.current.set(id, el)
	}, [])

	const activeSession = sessions.find((s) => s.id === activeId)

	return (
		<div
			ref={cardRef}
			className={cn(
				'rv-terminal overflow-hidden border border-[var(--term-border)] bg-[var(--term-bg)] shadow-[0_20px_50px_rgba(3,7,18,0.2)]',
				isFullscreen ? 'flex h-full flex-col rounded-none' : 'rounded-xl',
			)}
		>
			<TerminalTabBar
				sessions={sessions}
				activeId={activeId}
				isFullscreen={isFullscreen}
				onActivate={setActiveId}
				onAdd={addSession}
				onClose={closeSession}
				onRename={setRenamingId}
				onReconnect={() => activeId !== null && connect(activeId)}
				onToggleFullscreen={toggleFullscreen}
			/>
			{/* 终端区域：每个会话一个容器，切换时仅隐藏，保持会话存活 */}
			<div className={isFullscreen ? 'flex-1 overflow-hidden p-3' : 'p-3'}>
				{sessions.length === 0 ? (
					<div
						className="flex flex-col items-center justify-center gap-4 text-[var(--term-muted)]"
						style={{ height: paneHeight }}
					>
						<div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--term-border)] bg-[var(--term-bg-raised)]">
							<TerminalSquare className="h-5 w-5 text-sky-300" />
						</div>
						<div className="text-center">
							<p className="text-sm text-[var(--term-title)]">没有打开的会话</p>
							<p className="mt-1 text-xs">新建一个独立 SSH 连接开始操作</p>
						</div>
						<Button
							variant="default"
							size="sm"
							className="gap-1.5 border-[var(--term-border)] bg-[var(--term-bg-raised)] text-[var(--term-fg)] hover:bg-white/10 hover:text-[var(--term-title)]"
							onClick={addSession}
						>
							<Plus className="h-3.5 w-3.5" />
							新建终端会话
						</Button>
					</div>
				) : (
					sessions.map((session) => (
						<div
							key={session.id}
							ref={(el) => registerContainer(session.id, el)}
							className={session.id === activeId ? (isFullscreen ? 'h-full' : '') : 'hidden'}
							style={session.id === activeId && !isFullscreen ? { height: paneHeight } : undefined}
						/>
					))
				)}
			</div>
			<div className="flex h-8 items-center justify-between gap-3 border-t border-[var(--term-border)] bg-[#0a0e14] px-3 font-mono text-[11px] text-[var(--term-dim)]">
				<div className="flex min-w-0 items-center gap-2">
					{activeSession?.status === 'connecting' ? (
						<Loader2 className="h-3 w-3 shrink-0 animate-spin text-amber-400" />
					) : (
						<TerminalSquare className="h-3 w-3 shrink-0 text-sky-400" />
					)}
					<span className="truncate text-[var(--term-muted)]">
						{activeSession?.name ?? '没有活动会话'}
					</span>
					{activeSession && <span>{CONN_STATUS_LABEL[activeSession.status]}</span>}
				</div>
				<div className="flex shrink-0 items-center gap-3">
					<span>SSH · UTF-8</span>
					<span className="hidden sm:inline">输入与操作已审计</span>
				</div>
			</div>
			<RenameTerminalDialog
				session={sessions.find((session) => session.id === renamingId) ?? null}
				onOpenChange={(open) => {
					if (!open) setRenamingId(null)
				}}
				onRename={renameSession}
			/>
		</div>
	)
}
