'use client'

import { getMyPermissions } from '@/api/admin'
import { setAuthToken } from '@/api/auth'
import { getMe } from '@/api/users'
import { getSafeLoginRedirect } from '@/lib/loginRedirect'
import { useEffect, useState } from 'react'

/**
 * Google OAuth 落地页：后端回调带着 JWT 跳到这里，写入 localStorage 后再回业务页。
 */
export default function GoogleAuthCallbackPage() {
	const [message, setMessage] = useState('正在完成 Google 登录…')

	useEffect(() => {
		const params = new URLSearchParams(window.location.search)
		const error = params.get('error')
		if (error) {
			setMessage(error)
			return
		}

		const token = params.get('token')
		if (!token) {
			setMessage('缺少登录凭证，请返回登录页重试')
			return
		}

		let cancelled = false
		;(async () => {
			try {
				setAuthToken(token)
				const [meRes, permRes] = await Promise.all([getMe(), getMyPermissions()])
				if (cancelled) return

				const user = meRes.success ? meRes.data : undefined
				const permissions = permRes.success && permRes.data ? permRes.data.permissions : undefined
				setAuthToken(token, user, permissions)

				const redirect = params.get('redirect') || getSafeLoginRedirect()
				const safe = redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/briar/'
				window.location.replace(safe)
			} catch (err) {
				console.error('Google callback finish failed:', err)
				if (!cancelled) {
					setMessage(err instanceof Error ? err.message : '登录完成失败，请重试')
				}
			}
		})()

		return () => {
			cancelled = true
		}
	}, [])

	return (
		<div className="relative flex min-h-screen items-center justify-center overflow-hidden p-6">
			<div className="pointer-events-none fixed inset-0 -z-20 bg-background" />
			<div className="w-full max-w-md rounded-2xl border border-border/50 bg-card/80 p-8 text-center shadow-xl backdrop-blur-xl">
				<p className="text-sm text-muted-foreground">{message}</p>
				{message !== '正在完成 Google 登录…' && (
					<p className="mt-4 text-sm">
						<a href="/briar/login" className="text-primary hover:underline">
							返回登录
						</a>
					</p>
				)}
			</div>
		</div>
	)
}
