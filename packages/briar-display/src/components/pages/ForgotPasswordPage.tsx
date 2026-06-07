import { resetPassword, sendPasswordResetCode, setAuthToken } from '@/api/auth'
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

type Step = 'email' | 'reset'

export default function ForgotPasswordPage() {
	const [step, setStep] = useState<Step>('email')
	const [email, setEmail] = useState('')
	const [code, setCode] = useState('')
	const [newPassword, setNewPassword] = useState('')
	const [confirmPassword, setConfirmPassword] = useState('')
	const [showNewPassword, setShowNewPassword] = useState(false)
	const [showConfirmPassword, setShowConfirmPassword] = useState(false)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [success, setSuccess] = useState<string | null>(null)
	const [countdown, setCountdown] = useState(0)

	const handleSendCode = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		setLoading(true)
		setError(null)
		setSuccess(null)

		try {
			const result = await sendPasswordResetCode({ email })
			if (result.success) {
				setSuccess('验证码已发送到你的邮箱，请查收')
				setStep('reset')
				setCountdown(60)
				const interval = setInterval(() => {
					setCountdown((prev) => {
						if (prev <= 1) {
							clearInterval(interval)
							return 0
						}
						return prev - 1
					})
				}, 1000)
			} else {
				setError(result.message || '发送验证码失败')
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : '发送验证码失败')
		} finally {
			setLoading(false)
		}
	}

	const handleResetPassword = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()

		if (newPassword !== confirmPassword) {
			setError('两次输入的密码不一致')
			return
		}

		if (newPassword.length < 6) {
			setError('密码至少需要 6 个字符')
			return
		}

		setLoading(true)
		setError(null)
		setSuccess(null)

		try {
			const result = await resetPassword({
				email,
				code,
				newPassword,
			})
			if (result.success && result.data) {
				setAuthToken(result.data.token, result.data.user)
				setSuccess('密码重置成功，正在跳转...')
				setTimeout(() => {
					window.location.href = '/briar-display/'
				}, 2000)
			} else {
				setError(result.message || '重置密码失败')
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : '重置密码失败')
		} finally {
			setLoading(false)
		}
	}

	const handleBackToEmail = () => {
		setStep('email')
		setError(null)
		setSuccess(null)
		setCode('')
		setNewPassword('')
		setConfirmPassword('')
	}

	return (
		<div className="min-h-screen bg-[radial-gradient(circle_at_top,_hsl(var(--secondary))_0%,_hsl(var(--background))_55%)]">
			<div className="container flex min-h-screen items-center justify-center">
				<div className="grid w-full gap-8 lg:grid-cols-[1.2fr_0.8fr]">
					<div className="flex flex-col justify-center gap-6">
						<div className="space-y-3">
							<p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">
								Briar Workspace
							</p>
							<h1 className="text-4xl font-semibold leading-tight">
								{step === 'email' ? '重置密码' : '设置新密码'}
							</h1>
							<p className="text-lg text-muted-foreground">
								{step === 'email'
									? '输入你的邮箱地址，我们会向你发送验证码'
									: '输入验证码和新密码来重置你的账户密码'}
							</p>
						</div>
						<div className="grid gap-3 sm:grid-cols-2">
							<div className="rounded-xl border border-border/60 bg-card/60 p-4">
								<p className="text-sm text-muted-foreground">安全性高</p>
								<p className="text-2xl font-semibold">验证码</p>
								<p className="text-xs text-muted-foreground">邮箱一次性验证</p>
							</div>
							<div className="rounded-xl border border-border/60 bg-card/60 p-4">
								<p className="text-sm text-muted-foreground">有效期</p>
								<p className="text-2xl font-semibold">15分钟</p>
								<p className="text-xs text-muted-foreground">验证码过期时间</p>
							</div>
						</div>
					</div>

					<Card className="shadow-xl">
						{step === 'email' ? (
							<form onSubmit={handleSendCode}>
								<CardHeader>
									<CardTitle>邮箱验证</CardTitle>
									<CardDescription>输入你的邮箱地址来接收验证码</CardDescription>
								</CardHeader>
								<CardContent className="space-y-4">
									<div className="space-y-2">
										<Label htmlFor="email">邮箱地址</Label>
										<Input
											id="email"
											type="email"
											placeholder="name@company.com"
											value={email}
											onChange={(event) => setEmail(event.target.value)}
											required
										/>
									</div>
									{error && (
										<p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
											{error}
										</p>
									)}
									{success && (
										<p className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700">
											{success}
										</p>
									)}
								</CardContent>
								<CardFooter className="flex flex-col gap-3">
									<Button className="w-full" disabled={loading} type="submit">
										{loading ? '发送中...' : '发送验证码'}
									</Button>
									<p className="text-center text-xs text-muted-foreground">
										想起密码了？{' '}
										<a href="login" className="text-primary hover:underline">
											返回登录
										</a>
									</p>
								</CardFooter>
							</form>
						) : (
							<form onSubmit={handleResetPassword}>
								<CardHeader>
									<CardTitle>重置密码</CardTitle>
									<CardDescription>输入验证码和新密码来完成密码重置</CardDescription>
								</CardHeader>
								<CardContent className="space-y-4">
									<div className="space-y-2">
										<Label htmlFor="code">验证码</Label>
										<Input
											id="code"
											type="text"
											placeholder="请输入6位验证码"
											value={code}
											onChange={(event) => setCode(event.target.value.slice(0, 6))}
											maxLength={6}
											required
										/>
										<p className="text-xs text-muted-foreground">验证码已发送至 {email}</p>
									</div>
									<div className="space-y-2">
										<Label htmlFor="newPassword">新密码</Label>
										<div className="relative">
											<Input
												id="newPassword"
												type={showNewPassword ? 'text' : 'password'}
												placeholder="请输入新密码（至少6个字符）"
												value={newPassword}
												onChange={(event) => setNewPassword(event.target.value)}
												className="pr-12"
												required
											/>
											<button
												type="button"
												className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
												onClick={() => setShowNewPassword((visible) => !visible)}
												aria-label={showNewPassword ? '隐藏密码' : '显示密码'}
											>
												{showNewPassword ? (
													<EyeOff className="h-4 w-4" />
												) : (
													<Eye className="h-4 w-4" />
												)}
											</button>
										</div>
									</div>
									<div className="space-y-2">
										<Label htmlFor="confirmPassword">确认密码</Label>
										<div className="relative">
											<Input
												id="confirmPassword"
												type={showConfirmPassword ? 'text' : 'password'}
												placeholder="请再次输入密码"
												value={confirmPassword}
												onChange={(event) => setConfirmPassword(event.target.value)}
												className="pr-12"
												required
											/>
											<button
												type="button"
												className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
												onClick={() => setShowConfirmPassword((visible) => !visible)}
												aria-label={showConfirmPassword ? '隐藏密码' : '显示密码'}
											>
												{showConfirmPassword ? (
													<EyeOff className="h-4 w-4" />
												) : (
													<Eye className="h-4 w-4" />
												)}
											</button>
										</div>
									</div>
									{error && (
										<p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
											{error}
										</p>
									)}
									{success && (
										<p className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700">
											{success}
										</p>
									)}
								</CardContent>
								<CardFooter className="flex flex-col gap-3">
									<Button className="w-full" disabled={loading} type="submit">
										{loading ? '重置中...' : '重置密码'}
									</Button>
									<Button
										variant="outline"
										className="w-full"
										type="button"
										onClick={handleBackToEmail}
									>
										{countdown > 0 ? `重新发送 (${countdown}s)` : '没收到验证码？重新发送'}
									</Button>
									<p className="text-center text-xs text-muted-foreground">
										<a href="login" className="text-primary hover:underline">
											返回登录
										</a>
									</p>
								</CardFooter>
							</form>
						)}
					</Card>
				</div>
			</div>
		</div>
	)
}
