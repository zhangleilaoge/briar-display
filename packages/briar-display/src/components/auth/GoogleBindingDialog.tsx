'use client'

import {
	type LoginMethods,
	bindGoogleAccount,
	getLoginMethods,
	unbindGoogleAccount,
} from '@/api/auth'
import GoogleSignInButton from '@/components/auth/GoogleSignInButton'
import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { useCallback, useEffect, useState } from 'react'

const errorMessage = (err: unknown, fallback: string) =>
	(err as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback

interface Props {
	open: boolean
	onOpenChange: (open: boolean) => void
}

/** 「绑定谷歌账号」：查看登录方式，绑定 / 解绑 Google */
export default function GoogleBindingDialog({ open, onOpenChange }: Props) {
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

	useEffect(() => {
		if (open) {
			setNotice(null)
			void load()
		}
	}, [open, load])

	const google = methods?.identities.find((i) => i.provider === 'google')
	const canUnbind = !!methods && (methods.hasPassword || methods.identities.length > 1)

	const handleBind = async (credential: string) => {
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

	const handleUnbind = async () => {
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

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md" data-testid="google-binding-dialog">
				<DialogHeader>
					<DialogTitle>绑定谷歌账号</DialogTitle>
					<DialogDescription>
						绑定后可用 Google 一键登录当前账号；一个 Google 账号只能绑定一个本站用户。
					</DialogDescription>
				</DialogHeader>

				{loading && !methods ? (
					<p className="text-sm text-muted-foreground">加载中…</p>
				) : methods ? (
					<div className="space-y-4 text-sm">
						<div className="space-y-1 rounded-md border border-border p-3">
							<div className="flex items-center justify-between">
								<span>邮箱密码</span>
								<span className="text-muted-foreground">
									{methods.hasPassword ? '已设置' : '未设置'}
								</span>
							</div>
							<div className="flex items-center justify-between">
								<span>Google</span>
								<span className="truncate text-muted-foreground">
									{google ? `已绑定 ${google.email ?? ''}` : '未绑定'}
								</span>
							</div>
						</div>

						{google ? (
							<div className="space-y-2">
								<Button
									variant="outline"
									className="w-full"
									disabled={busy || !canUnbind}
									onClick={handleUnbind}
								>
									解绑 Google 账号
								</Button>
								{!canUnbind && (
									<p className="text-xs text-muted-foreground">
										Google 是你唯一的登录方式，请先在登录页「忘记密码」设置密码后再解绑。
									</p>
								)}
							</div>
						) : (
							<GoogleSignInButton
								text="continue_with"
								onCredential={handleBind}
								onError={setError}
							/>
						)}
					</div>
				) : null}

				{notice && <p className="text-sm text-green-600">{notice}</p>}
				{error && <p className="text-sm text-destructive">{error}</p>}
			</DialogContent>
		</Dialog>
	)
}
