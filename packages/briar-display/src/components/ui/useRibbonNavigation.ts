'use client'

import { getPreference, putPreference } from '@/api/users'
import { usePermissions } from '@/contexts/PermissionContext'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { DEFAULT_RIBBON_ORDER } from './ribbon-items'
import type { RibbonTagKind } from './ribbon-tags'
import { moveRibbonItem, normalizeRibbonOrder } from './ribbonPreferences'

const PREFERENCE_KEY = 'ribbon-navigation'

export function useRibbonNavigation() {
	const { isLoggedIn, loading, user } = usePermissions()
	const [order, setOrder] = useState<RibbonTagKind[]>(DEFAULT_RIBBON_ORDER)
	const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
	const [saving, setSaving] = useState(false)
	const orderRef = useRef(order)
	const savedOrderRef = useRef(order)
	const revisionRef = useRef(0)
	const writeQueueRef = useRef<Promise<void>>(Promise.resolve())

	const replaceOrder = useCallback((next: RibbonTagKind[]) => {
		orderRef.current = next
		setOrder(next)
	}, [])

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
			savedOrderRef.current = DEFAULT_RIBBON_ORDER
			replaceOrder(DEFAULT_RIBBON_ORDER)
			setStatus('ready')
			setSaving(false)
			return () => {
				active = false
			}
		}

		setStatus('loading')
		getPreference<unknown>(PREFERENCE_KEY)
			.then((response) => {
				if (!response.success) throw new Error(response.message)
				const next = normalizeRibbonOrder(response.data?.value, DEFAULT_RIBBON_ORDER)
				if (!active || revisionRef.current !== revision) return
				savedOrderRef.current = next
				replaceOrder(next)
				setStatus('ready')
			})
			.catch(() => {
				if (!active || revisionRef.current !== revision) return
				setStatus('error')
				toast.error('左侧标签设置读取失败，请刷新后重试')
			})
		return () => {
			active = false
		}
	}, [isLoggedIn, loading, replaceOrder, user?.id])

	const commit = useCallback(
		(next: RibbonTagKind[]) => {
			if (status !== 'ready' || !isLoggedIn) return false
			const normalized = normalizeRibbonOrder(next, DEFAULT_RIBBON_ORDER)
			const revision = ++revisionRef.current
			replaceOrder(normalized)
			setSaving(true)
			writeQueueRef.current = writeQueueRef.current
				.catch(() => undefined)
				.then(async () => {
					try {
						const response = await putPreference(PREFERENCE_KEY, normalized)
						if (!response.success) throw new Error(response.message)
						savedOrderRef.current = normalized
					} catch {
						if (revisionRef.current === revision) {
							replaceOrder(savedOrderRef.current)
							toast.error('标签设置保存失败，请重试')
						}
					} finally {
						if (revisionRef.current === revision) setSaving(false)
					}
				})
			return true
		},
		[isLoggedIn, replaceOrder, status],
	)

	const add = useCallback((kind: RibbonTagKind) => commit([...orderRef.current, kind]), [commit])
	const remove = useCallback(
		(kind: RibbonTagKind) => {
			if (orderRef.current.length <= 1 || !orderRef.current.includes(kind)) return false
			return commit(orderRef.current.filter((key) => key !== kind))
		},
		[commit],
	)
	const move = useCallback(
		(from: number, to: number, persist = true) => {
			const next = moveRibbonItem(orderRef.current, from, to)
			if (persist) return commit(next)
			if (status !== 'ready' || !isLoggedIn) return false
			replaceOrder(next)
			return true
		},
		[commit, isLoggedIn, replaceOrder, status],
	)
	const save = useCallback(() => commit(orderRef.current), [commit])
	const discard = useCallback(() => replaceOrder(savedOrderRef.current), [replaceOrder])

	return {
		order,
		canEdit: status === 'ready' && isLoggedIn && Boolean(user?.id),
		saving,
		add,
		remove,
		move,
		save,
		discard,
	}
}
