'use client'

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
		<div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
			{/* Mesh gradient background */}
			<div className="pointer-events-none fixed inset-0 -z-20">
				<div className="absolute inset-0 bg-background" />
				<div className="absolute -left-[10%] -top-[20%] h-[50%] w-[50%] rounded-full bg-indigo-600/20 blur-[120px]" />
				<div className="absolute -right-[15%] bottom-[10%] h-[45%] w-[45%] rounded-full bg-blue-500/15 blur-[100px]" />
				<div className="absolute left-1/2 top-1/2 h-[35%] w-[35%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-500/10 blur-[80px]" />
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

			{/* Centered card */}
			<Card className="relative w-full max-w-md bg-card/80 backdrop-blur-xl border border-border/50 rounded-2xl shadow-xl">
				{step === 'email' ? (
					<form onSubmit={handleSendCode}>
						<CardHeader className="text-center">
							<CardTitle className="text-xl">重置密码</CardTitle>
							<CardDescription>输入你的邮箱地址，我们会向你发送验证码</CardDescription>
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
								<p className="rounded-md border border-green-300 bg-green-500/10 px-3 py-2 text-sm text-green-700">
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
								<a href="/briar-display/login" className="text-primary hover:underline">
									返回登录
								</a>
							</p>
						</CardFooter>
					</form>
				) : (
					<form onSubmit={handleResetPassword}>
						<CardHeader className="text-center">
							<CardTitle className="text-xl">设置新密码</CardTitle>
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
										className="pr-10"
										required
									/>
									<Button
										type="button"
										variant="ghost"
										size="icon"
										className="absolute inset-y-0 right-0 h-full w-10 text-muted-foreground hover:text-foreground"
										onClick={() => setShowNewPassword((visible) => !visible)}
										aria-label={showNewPassword ? '隐藏密码' : '显示密码'}
									>
										{showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
									</Button>
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
										className="pr-10"
										required
									/>
									<Button
										type="button"
										variant="ghost"
										size="icon"
										className="absolute inset-y-0 right-0 h-full w-10 text-muted-foreground hover:text-foreground"
										onClick={() => setShowConfirmPassword((visible) => !visible)}
										aria-label={showConfirmPassword ? '隐藏密码' : '显示密码'}
									>
										{showConfirmPassword ? (
											<EyeOff className="h-4 w-4" />
										) : (
											<Eye className="h-4 w-4" />
										)}
									</Button>
								</div>
							</div>
							{error && (
								<p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
									{error}
								</p>
							)}
							{success && (
								<p className="rounded-md border border-green-300 bg-green-500/10 px-3 py-2 text-sm text-green-700">
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
								<a href="/briar-display/login" className="text-primary hover:underline">
									返回登录
								</a>
							</p>
						</CardFooter>
					</form>
				)}
			</Card>
		</div>
	)
}
