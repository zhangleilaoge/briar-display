'use client'

import GoogleSignInButton from '@/components/auth/GoogleSignInButton'
import { useLoginMethods } from '@/components/auth/useLoginMethods'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { KeyRound, Link2, Loader2, Mail } from 'lucide-react'
import { useEffect } from 'react'

const GoogleIcon = () => (
	<svg viewBox="0 0 48 48" className="h-4 w-4" aria-hidden="true">
		<path
			fill="#FFC107"
			d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
		/>
		<path
			fill="#FF3D00"
			d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
		/>
		<path
			fill="#4CAF50"
			d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
		/>
		<path
			fill="#1976D2"
			d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
		/>
	</svg>
)

const fmt = (d: string) => new Date(d).toLocaleString('zh-CN', { hour12: false })

/** 个人中心「登录方式」：邮箱密码 + Google（绑定 / 解绑，唯一登录方式时禁止解绑） */
export default function LoginMethodsCard({ email }: { email?: string | null }) {
	const { methods, loading, busy, error, notice, setError, load, google, canUnbind, bind, unbind } =
		useLoginMethods()

	useEffect(() => {
		void load()
	}, [load])

	return (
		<Card data-testid="login-methods-card">
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-base">
					<Link2 className="h-4 w-4" />
					登录方式
				</CardTitle>
				<CardDescription>可用于登录本账号的方式，至少保留一种</CardDescription>
			</CardHeader>
			<CardContent className="space-y-3">
				{loading && !methods ? (
					<div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
						<Loader2 className="h-4 w-4 animate-spin" />
						加载中…
					</div>
				) : methods ? (
					<>
						{/* 邮箱密码 */}
						<div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 py-2">
							<div className="flex min-w-0 items-center gap-3">
								<Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
								<div className="min-w-0">
									<p className="text-sm font-medium">邮箱密码</p>
									<p className="truncate text-xs text-muted-foreground">
										{email || '—'} · {methods.hasPassword ? '已设置密码' : '未设置密码'}
									</p>
								</div>
							</div>
							<a
								href="/briar/forgot-password"
								className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm transition-colors hover:bg-accent"
							>
								<KeyRound className="h-3.5 w-3.5" />
								{methods.hasPassword ? '修改密码' : '设置密码'}
							</a>
						</div>

						{/* Google */}
						<div className="flex flex-wrap items-center justify-between gap-3 py-2">
							<div className="flex min-w-0 items-center gap-3">
								<GoogleIcon />
								<div className="min-w-0">
									<p className="text-sm font-medium">Google</p>
									<p className="truncate text-xs text-muted-foreground">
										{google
											? `${google.email ?? '已绑定'} · 绑定于 ${fmt(google.createdAt)}`
											: '未绑定'}
									</p>
								</div>
							</div>
							{google ? (
								<Button
									variant="outline"
									size="sm"
									disabled={busy || !canUnbind}
									onClick={unbind}
									title={canUnbind ? undefined : 'Google 是你唯一的登录方式，请先设置密码'}
									data-testid="unbind-google-button"
								>
									{busy && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
									解绑
								</Button>
							) : (
								<div data-testid="bind-google-button">
									<GoogleSignInButton text="continue_with" onCredential={bind} onError={setError} />
								</div>
							)}
						</div>
						{google && !canUnbind && (
							<p className="text-xs text-muted-foreground">
								Google 是你唯一的登录方式，请先「设置密码」后再解绑。
							</p>
						)}
					</>
				) : null}
				{notice && <p className="text-sm text-green-600">{notice}</p>}
				{error && <p className="text-sm text-destructive">{error}</p>}
			</CardContent>
		</Card>
	)
}
