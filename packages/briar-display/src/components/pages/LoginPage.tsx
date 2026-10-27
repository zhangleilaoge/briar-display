'use client'

import { getGoogleLoginUrl, login, setAuthToken } from '@/api/auth'
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
		<div className="relative flex min-h-screen overflow-hidden">
			{/* Mesh gradient background */}
			<div className="pointer-events-none fixed inset-0 -z-20">
				<div className="absolute inset-0 bg-background" />
				<div className="absolute -left-[15%] -top-[15%] h-[55%] w-[55%] rounded-full bg-blue-600/20 blur-[120px]" />
				<div className="absolute bottom-[10%] right-[20%] h-[40%] w-[40%] rounded-full bg-indigo-500/15 blur-[100px]" />
				<div className="absolute left-[40%] top-[60%] h-[30%] w-[30%] rounded-full bg-violet-500/10 blur-[80px]" />
			</div>

			{/* Dot grid overlay */}
			<div
				className="pointer-events-none fixed inset-0 -z-10"
				style={{
					backgroundImage:
						'radial-gradient(circle, hsl(var(--muted-foreground) / 0.15) 1px, transparent 1px)',
					backgroundSize: '24px 24px',
				}}
			/>

			{/* Two-column layout */}
			<div className="grid w-full lg:grid-cols-2">
				{/* Left: Brand side */}
				<div className="relative hidden flex-col items-center justify-center overflow-hidden p-12 lg:flex">
					{/* Floating decorative circles */}
					<div className="absolute -left-16 top-1/4 h-64 w-64 rounded-full bg-blue-500/20 blur-[80px]" />
					<div className="absolute -right-8 bottom-1/3 h-48 w-48 rounded-full bg-indigo-500/20 blur-[60px]" />
					<div className="absolute left-1/3 top-1/2 h-32 w-32 rounded-full bg-violet-500/15 blur-[50px]" />

					<div className="relative z-10 space-y-6 text-center">
						<h1 className="bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 bg-clip-text text-6xl font-bold tracking-tight text-transparent">
							xiaobuzi
						</h1>
						<p className="text-xl text-muted-foreground">欢迎回来</p>
					</div>
				</div>

				{/* Right: Form side */}
				<div className="flex items-center justify-center p-6 lg:p-12">
					<Card className="w-full max-w-md bg-card/80 backdrop-blur-xl border border-border/50 rounded-2xl shadow-xl">
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
								<Button
									type="button"
									variant="outline"
									className="w-full gap-2"
									disabled={loading}
									onClick={() => {
										window.location.href = getGoogleLoginUrl()
									}}
								>
									<svg aria-hidden className="h-4 w-4" viewBox="0 0 24 24">
										<path
											fill="#4285F4"
											d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
										/>
										<path
											fill="#34A853"
											d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
										/>
										<path
											fill="#FBBC05"
											d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
										/>
										<path
											fill="#EA4335"
											d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
										/>
									</svg>
									使用 Google 登录
								</Button>
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
		</div>
	)
}
