import type { ApiResponse } from '@briar/shared'
import { useCallback, useEffect, useRef, useState } from 'react'

/** 从 axios 错误 / 接口失败响应里取可读的错误信息 */
export function readableError(err: unknown): string {
	const data = (err as { response?: { data?: ApiResponse } })?.response?.data
	if (data?.message) return data.message
	return err instanceof Error ? err.message : '加载失败'
}

/** 接口 success=false 时抛错，统一走 catch */
export function unwrap<T>(res: ApiResponse<T>): T {
	if (!res.success || res.data === undefined) throw new Error(res.message || '加载失败')
	return res.data
}

/**
 * 行情轮询：间隔由数据自己决定（后端按交易时段给 pollMs：交易中 20s / 休市 5min），
 * 页面隐藏时暂停、回到前台立即刷新；deps 变化（切市场/板块类别）重新开始。
 */
export function useMarketPolling<T>(
	load: () => Promise<T>,
	intervalOf: (data: T) => number,
	deps: unknown[],
) {
	const [data, setData] = useState<T | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [loading, setLoading] = useState(true)
	const [refreshing, setRefreshing] = useState(false)
	const loadRef = useRef(load)
	const intervalRef = useRef(intervalOf)
	loadRef.current = load
	intervalRef.current = intervalOf
	const runRef = useRef<() => Promise<void>>(async () => {})

	useEffect(() => {
		let cancelled = false
		let timer: ReturnType<typeof setTimeout> | undefined
		let latest: T | null = null
		setLoading(true)
		setError(null)

		const schedule = () => {
			clearTimeout(timer)
			const ms = latest ? intervalRef.current(latest) : 30_000
			timer = setTimeout(run, ms)
		}

		const run = async () => {
			clearTimeout(timer)
			if (document.hidden) {
				schedule()
				return
			}
			setRefreshing(true)
			try {
				const next = await loadRef.current()
				if (cancelled) return
				latest = next
				setData(next)
				setError(null)
			} catch (err) {
				if (!cancelled) setError(readableError(err))
			} finally {
				if (!cancelled) {
					setLoading(false)
					setRefreshing(false)
					schedule()
				}
			}
		}
		runRef.current = run

		const onVisibility = () => {
			if (!document.hidden) run()
		}
		document.addEventListener('visibilitychange', onVisibility)
		run()
		return () => {
			cancelled = true
			clearTimeout(timer)
			document.removeEventListener('visibilitychange', onVisibility)
		}
	}, deps)

	const refresh = useCallback(() => {
		runRef.current()
	}, [])

	return { data, error, loading, refreshing, refresh }
}
