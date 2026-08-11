'use client'

import { login, setAuthToken } from '@/api/auth'
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
				window.location.href = '/briar/'
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
							Briar
						</h1>
						<p className="text-xl text-muted-foreground">欢迎回来</p>
					</div>
				</div>

				{/* Right: Form side */}
				<div className="flex items-center justify-center p-6 lg:p-12">
					<Card className="w-full max-w-md bg-card/80 backdrop-blur-xl border border-border/50 rounded-2xl shadow-xl">
						<form onSubmit={handleSubmit}>
							<CardHeader className="text-center">
								<CardTitle className="text-xl">登录 Briar</CardTitle>
								<CardDescription>使用你的邮箱和密码登录</CardDescription>
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
