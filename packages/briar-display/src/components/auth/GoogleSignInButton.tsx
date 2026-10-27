'use client'

import { loginWithGoogleCredential, setAuthToken } from '@/api/auth'
import { getSafeLoginRedirect } from '@/lib/loginRedirect'
import { useEffect, useRef, useState } from 'react'

/**
 * Google Identity Services 登录按钮。
 * 浏览器直连 Google 拿 ID Token（credential），交给后端本地验签换本站 JWT；
 * 服务器全程不需要访问 Google。
 */

const GIS_SRC = 'https://accounts.google.com/gsi/client'

/** Client ID 是公开值；可用 PUBLIC_GOOGLE_CLIENT_ID 覆盖（本地/测试客户端） */
const GOOGLE_CLIENT_ID =
	(typeof import.meta.env !== 'undefined' ? import.meta.env.PUBLIC_GOOGLE_CLIENT_ID : undefined) ||
	'474345035956-al2lp1r93u9h9b543klodu0n4fu81ac4.apps.googleusercontent.com'

interface GoogleCredentialResponse {
	credential?: string
}

interface GoogleAccountsId {
	initialize: (options: {
		client_id: string
		callback: (response: GoogleCredentialResponse) => void
		ux_mode?: 'popup' | 'redirect'
		auto_select?: boolean
		cancel_on_tap_outside?: boolean
		use_fedcm_for_button?: boolean
	}) => void
	renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void
}

declare global {
	interface Window {
		google?: { accounts?: { id?: GoogleAccountsId } }
	}
}

let scriptPromise: Promise<void> | null = null

const loadGisScript = () => {
	if (window.google?.accounts?.id) return Promise.resolve()
	scriptPromise ??= new Promise<void>((resolve, reject) => {
		const script = document.createElement('script')
		script.src = GIS_SRC
		script.async = true
		script.defer = true
		script.onload = () => resolve()
		script.onerror = () => {
			scriptPromise = null
			script.remove()
			reject(new Error('GIS_LOAD_FAILED'))
		}
		document.head.appendChild(script)
	})
	return scriptPromise
}

interface Props {
	disabled?: boolean
	onError?: (message: string | null) => void
}

export default function GoogleSignInButton({ disabled, onError }: Props) {
	const containerRef = useRef<HTMLDivElement>(null)
	const [status, setStatus] = useState<'loading' | 'ready' | 'failed' | 'submitting'>('loading')

	useEffect(() => {
		let cancelled = false

		const handleCredential = async (response: GoogleCredentialResponse) => {
			if (!response.credential) {
				onError?.('Google 未返回登录凭证，请重试')
				return
			}
			setStatus('submitting')
			onError?.(null)
			try {
				const result = await loginWithGoogleCredential(response.credential)
				if (result.success && result.data) {
					setAuthToken(result.data.token, result.data.user, result.data.permissions)
					window.location.href = getSafeLoginRedirect()
					return
				}
				onError?.(result.message || 'Google 登录失败')
			} catch (err) {
				const data = (err as { response?: { data?: { message?: string } } })?.response?.data
				onError?.(data?.message || 'Google 登录失败，请稍后再试')
			}
			setStatus('ready')
		}

		loadGisScript()
			.then(() => {
				const gis = window.google?.accounts?.id
				const el = containerRef.current
				if (cancelled || !gis || !el) return
				gis.initialize({
					client_id: GOOGLE_CLIENT_ID,
					callback: handleCredential,
					ux_mode: 'popup',
					auto_select: false,
					cancel_on_tap_outside: true,
				})
				gis.renderButton(el, {
					type: 'standard',
					theme: 'outline',
					size: 'large',
					text: 'signin_with',
					shape: 'rectangular',
					logo_alignment: 'center',
					locale: 'zh_CN',
					width: Math.min(400, Math.max(200, Math.floor(el.clientWidth || 320))),
				})
				setStatus('ready')
			})
			.catch(() => {
				if (!cancelled) setStatus('failed')
			})

		return () => {
			cancelled = true
		}
		// onError 由父组件传入的 setState，稳定；只需初始化一次
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	return (
		<div className="w-full">
			<div
				ref={containerRef}
				data-testid="google-signin-button"
				className={`flex min-h-[44px] w-full justify-center ${
					disabled || status === 'submitting' ? 'pointer-events-none opacity-60' : ''
				}`}
			/>
			{status === 'loading' && (
				<p className="text-center text-xs text-muted-foreground">正在加载 Google 登录…</p>
			)}
			{status === 'submitting' && (
				<p className="mt-1 text-center text-xs text-muted-foreground">正在完成 Google 登录…</p>
			)}
			{status === 'failed' && (
				<p className="text-center text-xs text-muted-foreground">
					无法加载 Google 登录（当前网络可能无法访问 Google），请使用邮箱密码登录
				</p>
			)}
		</div>
	)
}
