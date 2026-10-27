'use client'

import GoogleSignInButton from '@/components/auth/GoogleSignInButton'
import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { useEffect } from 'react'
import { useLoginMethods } from './useLoginMethods'

interface Props {
	open: boolean
	onOpenChange: (open: boolean) => void
}

/** 「绑定谷歌账号」：查看登录方式，绑定 / 解绑 Google */
export default function GoogleBindingDialog({ open, onOpenChange }: Props) {
	const {
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
	} = useLoginMethods()

	useEffect(() => {
		if (open) {
			setNotice(null)
			void load()
		}
	}, [open, load, setNotice])

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
									onClick={unbind}
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
							<GoogleSignInButton text="continue_with" onCredential={bind} onError={setError} />
						)}
					</div>
				) : null}

				{notice && <p className="text-sm text-green-600">{notice}</p>}
				{error && <p className="text-sm text-destructive">{error}</p>}
			</DialogContent>
		</Dialog>
	)
}
