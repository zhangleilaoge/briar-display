'use client'

import { login, setAuthToken } from '@/api/auth'
import GoogleSignInButton from '@/components/auth/GoogleSignInButton'
import { Button } from '@/components/ui/button'
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { BrandCollage, ThemeShell } from '@/components/ui/theme-shell'
import { getSafeLoginRedirect } from '@/lib/loginRedirect'
import axios from 'axios'
import { Eye, EyeOff } from 'lucide-react'
import { type FormEvent, useState } from 'react'

const getLoginErrorMessage = (err: unknown) => {
	if (axios.isAxiosError<{ message?: string }>(err)) {
		if (err.response?.data?.message) {
			return err.response.data.message
		}
		if (!err.response) {
			return '无法连接服务器，请检查网络或稍后再试'
		}
	}
	return err instanceof Error ? err.message : '登录失败'
}

export default function LoginPage() {
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [showPassword, setShowPassword] = useState(false)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		setLoading(true)
		setError(null)

		try {
			const result = await login({ email, password })
			if (result.success && result.data) {
				setAuthToken(result.data.token, result.data.user, result.data.permissions)
				// 优先回到触发登录跳转之前的页面（见 lib/loginRedirect）
				window.location.href = getSafeLoginRedirect()
				return
			}
			setError(result.message || '登录失败')
		} catch (err) {
			setError(getLoginErrorMessage(err))
		} finally {
			setLoading(false)
		}
	}

	return (
		<ThemeShell variant="scrapbook" sidebar={false} className="flex overflow-hidden">
			{/* Two-column layout */}
			<div className="grid w-full lg:grid-cols-2">
				{/* Left: Brand side */}
				<div className="relative hidden flex-col items-center justify-center overflow-hidden p-12 lg:flex">
					<BrandCollage script="Bon retour" subtitle="欢迎回来" className="relative z-10" />
				</div>

				{/* Right: Form side */}
				<div className="flex items-center justify-center p-6 lg:p-12">
					<Card className="w-full max-w-md shadow-raised">
						<form onSubmit={handleSubmit}>
							<CardHeader className="text-center">
								<CardTitle className="text-xl">登录 xiaobuzi</CardTitle>
								<CardDescription>使用邮箱密码，或 Google 账号登录</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="space-y-2">
									<Label htmlFor="email">邮箱</Label>
									<Input
										id="email"
										type="email"
										placeholder="name@example.com"
										value={email}
										onChange={(event) => setEmail(event.target.value)}
										required
									/>
								</div>
								<div className="space-y-2">
									<div className="flex items-center justify-between">
										<Label htmlFor="password">密码</Label>
										<a
											href="/briar/forgot-password"
											className="text-xs text-muted-foreground hover:text-primary"
										>
											忘记密码？
										</a>
									</div>
									<div className="relative">
										<Input
											id="password"
											type={showPassword ? 'text' : 'password'}
											placeholder="请输入密码"
											value={password}
											onChange={(event) => setPassword(event.target.value)}
											className="pr-10"
											required
										/>
										<Button
											type="button"
											variant="ghost"
											size="icon"
											className="absolute inset-y-0 right-0 h-full w-10 text-muted-foreground hover:text-foreground"
											onClick={() => setShowPassword((visible) => !visible)}
											aria-label={showPassword ? '隐藏密码' : '显示密码'}
										>
											{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
										</Button>
									</div>
								</div>
								{error && (
									<p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
										{error}
									</p>
								)}
							</CardContent>
							<CardFooter className="flex flex-col gap-3">
								<Button className="w-full" disabled={loading} type="submit">
									{loading ? '登录中...' : '登录'}
								</Button>
								<div className="relative flex w-full items-center gap-3 py-1">
									<div className="h-px flex-1 bg-border" />
									<span className="text-xs text-muted-foreground">或</span>
									<div className="h-px flex-1 bg-border" />
								</div>
								<GoogleSignInButton disabled={loading} onError={setError} />
								<p className="text-center text-xs text-muted-foreground">
									还没有账号？{' '}
									<a href="/briar/register" className="text-primary hover:underline">
										创建账号
									</a>
								</p>
							</CardFooter>
						</form>
					</Card>
				</div>
			</div>
		</ThemeShell>
	)
}
