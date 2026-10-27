import {
	type LoginMethods,
	bindGoogleAccount,
	getLoginMethods,
	unbindGoogleAccount,
} from '@/api/auth'
import { useCallback, useState } from 'react'

const errorMessage = (err: unknown, fallback: string) =>
	(err as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback

/** 当前用户的登录方式 + Google 绑定/解绑（个人中心「登录方式」卡片使用） */
export function useLoginMethods() {
	const [methods, setMethods] = useState<LoginMethods | null>(null)
	const [loading, setLoading] = useState(false)
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [notice, setNotice] = useState<string | null>(null)

	const load = useCallback(async () => {
		setLoading(true)
		setError(null)
		try {
			const res = await getLoginMethods()
			if (res.success && res.data) setMethods(res.data)
			else setError(res.message || '获取登录方式失败')
		} catch (err) {
			setError(errorMessage(err, '获取登录方式失败'))
		} finally {
			setLoading(false)
		}
	}, [])

	const google = methods?.identities.find((i) => i.provider === 'google')
	/** 解绑后仍需至少一种登录方式 */
	const canUnbind = !!methods && (methods.hasPassword || methods.identities.length > 1)

	const bind = async (credential: string) => {
		setError(null)
		setNotice(null)
		try {
			const res = await bindGoogleAccount(credential)
			if (res.success && res.data) {
				setMethods(res.data)
				setNotice('已绑定 Google 账号，之后可用 Google 直接登录本账号')
			} else {
				setError(res.message || '绑定失败')
			}
		} catch (err) {
			setError(errorMessage(err, '绑定失败，请稍后再试'))
		}
	}

	const unbind = async () => {
		if (!window.confirm('确定解绑 Google 账号？解绑后将无法用该 Google 账号登录。')) return
		setBusy(true)
		setError(null)
		setNotice(null)
		try {
			const res = await unbindGoogleAccount()
			if (res.success && res.data) {
				setMethods(res.data)
				setNotice('已解绑 Google 账号')
			} else {
				setError(res.message || '解绑失败')
			}
		} catch (err) {
			setError(errorMessage(err, '解绑失败，请稍后再试'))
		} finally {
			setBusy(false)
		}
	}

	return {
		methods,
		loading,
		busy,
		error,
		notice,
		setError,
		setNotice,
		load,
		google,
		canUnbind,
		bind,
		unbind,
	}
}
