'use client'

import { getPreference, putPreference } from '@/api/users'
import { TOOLS_SECTION } from '@/config/site-routes'
import { usePermissions } from '@/contexts/PermissionContext'
import { publishPreference, subscribePreference } from '@/lib/preferenceBus'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
	TOOLS_HIDDEN_PREFERENCE_KEY,
	normalizeHiddenTools,
	readHiddenToolsCache,
	toggleHiddenTool,
	writeHiddenToolsCache,
} from './toolsVisibility'

export const TOOL_PATHS = TOOLS_SECTION.children.map((sub) => sub.path)
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

/** 工具箱 tab 显隐偏好：与侧栏 useRibbonLock 同一套读写方式（偏好 KV + 本地缓存 + 失败回滚） */
export function useToolsVisibility() {
	const { isLoggedIn, loading, user } = usePermissions()
	const [hidden, setHidden] = useState<string[]>([])
	const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
	const hiddenRef = useRef<string[]>([])
	const savedRef = useRef<string[]>([])
	const revisionRef = useRef(0)
	const writeQueueRef = useRef<Promise<void>>(Promise.resolve())
	const sourceRef = useRef(Symbol(TOOLS_HIDDEN_PREFERENCE_KEY))

	const replaceHidden = useCallback((next: string[]) => {
		hiddenRef.current = next
		setHidden(next)
	}, [])

	useEffect(
		() =>
			subscribePreference(TOOLS_HIDDEN_PREFERENCE_KEY, (value, source) => {
				if (source === sourceRef.current) return
				const next = normalizeHiddenTools(value, TOOL_PATHS)
				savedRef.current = next
				replaceHidden(next)
			}),
		[replaceHidden],
	)

	useIsomorphicLayoutEffect(() => {
		const cached = readHiddenToolsCache(window.localStorage, TOOL_PATHS)
		if (!cached) return
		savedRef.current = cached
		replaceHidden(cached)
	}, [replaceHidden])

	useEffect(() => {
		let active = true
		const revision = ++revisionRef.current
		if (loading) {
			setStatus('loading')
			return () => {
				active = false
			}
		}
		if (!isLoggedIn || !user?.id) {
			savedRef.current = []
			replaceHidden([])
			setStatus('ready')
			return () => {
				active = false
			}
		}
		setStatus('loading')
		getPreference<unknown>(TOOLS_HIDDEN_PREFERENCE_KEY)
			.then((response) => {
				if (!response.success) throw new Error(response.message)
				const next = normalizeHiddenTools(response.data?.value, TOOL_PATHS)
				if (!active || revisionRef.current !== revision) return
				writeHiddenToolsCache(window.localStorage, user.id, next)
				savedRef.current = next
				replaceHidden(next)
				setStatus('ready')
			})
			.catch(() => {
				if (!active || revisionRef.current !== revision) return
				setStatus('error')
			})
		return () => {
			active = false
		}
	}, [isLoggedIn, loading, replaceHidden, user?.id])

	const setToolVisible = useCallback(
		(path: string, visible: boolean) => {
			if (status !== 'ready' || !isLoggedIn || !user?.id) return false
			const next = toggleHiddenTool(hiddenRef.current, path, visible, TOOL_PATHS)
			if (
				next.length === hiddenRef.current.length &&
				next.every((p, i) => p === hiddenRef.current[i])
			)
				return false
			const revision = ++revisionRef.current
			const userId = user.id
			writeHiddenToolsCache(window.localStorage, userId, next)
			replaceHidden(next)
			publishPreference(TOOLS_HIDDEN_PREFERENCE_KEY, next, sourceRef.current)
			writeQueueRef.current = writeQueueRef.current
				.catch(() => undefined)
				.then(async () => {
					try {
						const response = await putPreference(TOOLS_HIDDEN_PREFERENCE_KEY, next)
						if (!response.success) throw new Error(response.message)
						savedRef.current = next
					} catch {
						if (revisionRef.current === revision) {
							writeHiddenToolsCache(window.localStorage, userId, savedRef.current)
							replaceHidden(savedRef.current)
							publishPreference(TOOLS_HIDDEN_PREFERENCE_KEY, savedRef.current, sourceRef.current)
							toast.error('工具箱显示设置保存失败，请重试')
						}
					}
				})
			return true
		},
		[isLoggedIn, replaceHidden, status, user?.id],
	)

	return {
		hidden,
		canEdit: status === 'ready' && isLoggedIn && Boolean(user?.id),
		setToolVisible,
	}
}
