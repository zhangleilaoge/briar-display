'use client'

import { register, setAuthToken } from '@/api/auth'
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
import { Eye, EyeOff } from 'lucide-react'
import { type FormEvent, useState } from 'react'

export default function RegisterPage() {
	const [firstName, setFirstName] = useState('')
	const [lastName, setLastName] = useState('')
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
	const [showPassword, setShowPassword] = useState(false)
	const [invite, setInvite] = useState('')
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		setLoading(true)
		setError(null)

		try {
			const name = `${firstName} ${lastName}`.trim()
			const result = await register({
				name: name || 'New User',
				email,
				password,
			})
			if (result.success && result.data) {
				setAuthToken(result.data.token, result.data.user)
				window.location.href = '/briar/'
				return
			}
			setError(result.message || '注册失败')
		} catch (err) {
			setError(err instanceof Error ? err.message : '注册失败')
		} finally {
			setLoading(false)
		}
	}

	return (
		<div className="relative flex min-h-screen overflow-hidden">
			{/* Mesh gradient background */}
			<div className="pointer-events-none fixed inset-0 -z-20">
				<div className="absolute inset-0 bg-background" />
				<div className="absolute -right-[15%] -top-[15%] h-[55%] w-[55%] rounded-full bg-purple-600/20 blur-[120px]" />
				<div className="absolute bottom-[10%] left-[20%] h-[40%] w-[40%] rounded-full bg-blue-500/15 blur-[100px]" />
				<div className="absolute right-1/3 top-1/2 h-[30%] w-[30%] rounded-full bg-teal-500/10 blur-[80px]" />
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

			{/* Two-column layout — reversed order */}
			<div className="grid w-full lg:grid-cols-2">
				{/* Left: Form side */}
				<div className="flex items-center justify-center p-6 lg:p-12">
					<Card className="w-full max-w-md bg-card/80 backdrop-blur-xl border border-border/50 rounded-2xl shadow-xl">
						<form onSubmit={handleSubmit}>
							<CardHeader>
								<CardTitle>创建账号</CardTitle>
								<CardDescription>快速完成注册，开启业务空间</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="grid gap-4 sm:grid-cols-2">
									<div className="space-y-2">
										<Label htmlFor="firstName">名字</Label>
										<Input
											id="firstName"
											placeholder="Zhang"
											value={firstName}
											onChange={(event) => setFirstName(event.target.value)}
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="lastName">姓氏</Label>
										<Input
											id="lastName"
											placeholder="Lei"
											value={lastName}
											onChange={(event) => setLastName(event.target.value)}
										/>
									</div>
								</div>
								<div className="space-y-2">
									<Label htmlFor="email">邮箱</Label>
									<Input
										id="email"
										type="email"
										placeholder="name@company.com"
										value={email}
										onChange={(event) => setEmail(event.target.value)}
										required
									/>
								</div>
								<div className="grid gap-4 sm:grid-cols-2">
									<div className="space-y-2">
										<Label htmlFor="password">设置密码</Label>
										<div className="relative">
											<Input
												id="password"
												type={showPassword ? 'text' : 'password'}
												placeholder="至少 8 位"
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
												{showPassword ? (
													<EyeOff className="h-4 w-4" />
												) : (
													<Eye className="h-4 w-4" />
												)}
											</Button>
										</div>
									</div>
									<div className="space-y-2">
										<Label htmlFor="invite">邀请码</Label>
										<Input
											id="invite"
											placeholder="可选"
											value={invite}
											onChange={(event) => setInvite(event.target.value)}
										/>
									</div>
								</div>
								<div className="rounded-lg border border-dashed border-border/60 bg-muted/40 p-4 text-sm text-muted-foreground">
									注册即表示你已阅读并同意服务条款与隐私政策。
								</div>
								{error && (
									<p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
										{error}
									</p>
								)}
							</CardContent>
							<CardFooter className="flex flex-col gap-3">
								<Button className="w-full" disabled={loading} type="submit">
									{loading ? '提交中...' : '创建账号'}
								</Button>
								<p className="text-center text-xs text-muted-foreground">
									已有账号？{' '}
									<a href="/briar/login" className="text-primary hover:underline">
										返回登录
									</a>
								</p>
							</CardFooter>
						</form>
					</Card>
				</div>

				{/* Right: Brand side */}
				<div className="relative hidden flex-col items-center justify-center overflow-hidden p-12 lg:flex">
					{/* Floating decorative circles */}
					<div className="absolute -right-16 top-1/4 h-64 w-64 rounded-full bg-purple-500/20 blur-[80px]" />
					<div className="absolute -left-8 bottom-1/3 h-48 w-48 rounded-full bg-blue-500/20 blur-[60px]" />
					<div className="absolute right-1/3 top-1/2 h-32 w-32 rounded-full bg-teal-500/15 blur-[50px]" />

					<div className="relative z-10 space-y-6 text-center">
						<h1 className="bg-gradient-to-br from-purple-600 via-blue-600 to-teal-500 bg-clip-text text-6xl font-bold tracking-tight text-transparent">
							xiaobuzi
						</h1>
						<p className="text-xl text-muted-foreground">开始使用</p>
					</div>
				</div>
			</div>
		</div>
	)
}
