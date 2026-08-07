'use client'

import { getDeviceToken } from '@/api/terminal'
import { Button } from '@/components/ui/button'
import { NODE_PORT } from '@briar/shared'
import type { FitAddon } from '@xterm/addon-fit'
import type { Terminal } from '@xterm/xterm'
import { Plus, RotateCcw, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import '@xterm/xterm/css/xterm.css'

type ConnStatus = 'connecting' | 'connected' | 'closed' | 'error'

interface Session {
	id: number
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

const STATUS_DOT: Record<ConnStatus, string> = {
	connecting: 'bg-yellow-400 animate-pulse',
	connected: 'bg-green-400',
	closed: 'bg-gray-500',
	error: 'bg-red-400',
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
	const [sessions, setSessions] = useState<Session[]>([])
	const [activeId, setActiveId] = useState<number | null>(null)

	const nextIdRef = useRef(1)
	const libRef = useRef<XtermLib | null>(null)
	const instancesRef = useRef(new Map<number, Instance>())
	const containersRef = useRef(new Map<number, HTMLDivElement>())

	const setSessionStatus = useCallback((id: number, status: ConnStatus) => {
		setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)))
	}, [])

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
				fontSize: 13,
				fontFamily: 'Menlo, Monaco, "Courier New", monospace',
				cursorBlink: true,
				theme: { background: '#0c0c0c' },
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
		setSessions((prev) => [...prev, { id, status: 'connecting' }])
		setActiveId(id)
	}, [])

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

	// 窗口尺寸变化时 fit 当前会话
	useEffect(() => {
		const onResize = () => {
			if (activeId === null) return
			const inst = instancesRef.current.get(activeId)
			if (!inst) return
			inst.fit.fit()
			if (inst.ws?.readyState === WebSocket.OPEN) {
				inst.ws.send(JSON.stringify({ type: 'resize', cols: inst.term.cols, rows: inst.term.rows }))
			}
		}
		window.addEventListener('resize', onResize)
		return () => window.removeEventListener('resize', onResize)
	}, [activeId])

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
		<div className="overflow-hidden rounded-lg border border-[#2d2d2d] bg-[#0c0c0c] shadow-lg">
			{/* 标签栏 */}
			<div className="flex items-center gap-1 bg-[#1e1e1e] px-2 pt-1.5">
				{sessions.map((s, i) => (
					<div
						key={s.id}
						role="tab"
						tabIndex={0}
						aria-selected={s.id === activeId}
						onClick={() => setActiveId(s.id)}
						onKeyDown={(e) => e.key === 'Enter' && setActiveId(s.id)}
						className={`group flex cursor-pointer items-center gap-2 rounded-t-md px-3 py-1.5 text-xs transition-colors ${
							s.id === activeId
								? 'bg-[#0c0c0c] text-gray-200'
								: 'text-gray-500 hover:bg-[#2a2a2a] hover:text-gray-300'
						}`}
					>
						<span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[s.status]}`} />
						<span>终端 {i + 1}</span>
						<button
							type="button"
							aria-label="关闭会话"
							onClick={(e) => {
								e.stopPropagation()
								closeSession(s.id)
							}}
							className="rounded p-0.5 text-gray-600 hover:bg-[#3a3a3a] hover:text-gray-300"
						>
							<X className="h-3 w-3" />
						</button>
					</div>
				))}
				<button
					type="button"
					aria-label="新建会话"
					onClick={addSession}
					className="rounded p-1.5 text-gray-500 hover:bg-[#2a2a2a] hover:text-gray-300"
				>
					<Plus className="h-3.5 w-3.5" />
				</button>
				<div className="flex-1" />
				{activeSession && (
					<Button
						variant="ghost"
						size="sm"
						className="mb-1 h-6 gap-1.5 px-2 text-xs text-gray-400 hover:bg-[#2a2a2a] hover:text-gray-200"
						onClick={() => activeId !== null && connect(activeId)}
						disabled={activeSession.status === 'connecting'}
					>
						<RotateCcw className="h-3 w-3" />
						重新连接
					</Button>
				)}
			</div>
			{/* 终端区域：每个会话一个容器，切换时仅隐藏，保持会话存活 */}
			<div className="p-2">
				{sessions.length === 0 ? (
					<div className="flex h-[480px] flex-col items-center justify-center gap-3 text-gray-500">
						<p className="text-sm">没有打开的会话</p>
						<Button
							variant="outline"
							size="sm"
							className="gap-1.5 border-[#3a3a3a] bg-transparent text-gray-300 hover:bg-[#2a2a2a] hover:text-gray-100"
							onClick={addSession}
						>
							<Plus className="h-3.5 w-3.5" />
							新建终端会话
						</Button>
					</div>
				) : (
					sessions.map((s) => (
						<div
							key={s.id}
							ref={(el) => registerContainer(s.id, el)}
							className={s.id === activeId ? 'h-[480px]' : 'hidden'}
						/>
					))
				)}
			</div>
		</div>
	)
}
