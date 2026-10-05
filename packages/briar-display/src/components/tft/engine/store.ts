import { useSyncExternalStore } from 'react'
import { GameEngine } from './gameLoop'

/** debug 模式：?debug 开启（高速档/跳阶段按钮），&to=3-2 开局直达指定回合 */
const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
export const tftDebug = {
	enabled: params?.has('debug') ?? false,
	to: params?.get('to') ?? null,
}

/** 引擎以 20fps 外部驱动；UI 通过 version 快照重渲染（state 为引擎内可变对象） */
class TftStore {
	engine: GameEngine | null = null
	speed = 1
	private version = 0
	private listeners = new Set<() => void>()
	private timer: ReturnType<typeof setInterval> | null = null
	private last = 0

	start(): void {
		this.stop()
		this.engine = new GameEngine(Date.now() % 2147483647)
		this.last = performance.now()
		this.timer = setInterval(() => this.frame(), 50)
		this.bump()
	}

	stop(): void {
		if (this.timer) clearInterval(this.timer)
		this.timer = null
	}

	quit(): void {
		this.stop()
		this.engine = null
		this.bump()
	}

	private frame(): void {
		if (!this.engine) return
		const now = performance.now()
		const dt = (now - this.last) * this.speed
		this.last = now
		this.engine.tick(dt)
		this.bump()
	}

	setSpeed(s: number): void {
		this.speed = s
		this.last = performance.now()
		this.bump()
	}

	subscribe = (fn: () => void) => {
		this.listeners.add(fn)
		return () => {
			this.listeners.delete(fn)
		}
	}

	getSnapshot = () => this.version
	getServerSnapshot = () => 0

	private bump(): void {
		this.version += 1
		for (const fn of this.listeners) fn()
	}
}

export const tftStore = new TftStore()
export const useTftVersion = () =>
	useSyncExternalStore(tftStore.subscribe, tftStore.getSnapshot, tftStore.getServerSnapshot)
