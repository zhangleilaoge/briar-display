'use client'

import {
	getPrivacyStatus,
	resetPrivacyPassword,
	sendPrivacyCode,
	setupPrivacyPassword,
	unlockPrivacy,
} from '@/api/files'
import { setPrivacyToken } from '@/api/request'
import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, Lock, Mail } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

const RESEND_COUNTDOWN = 60

type View = 'unlock' | 'setup' | 'reset'

interface PrivacyUnlockDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	/** 解锁/设置成功（token 已写入 sessionStorage） */
	onUnlocked: () => void
}

/** 隐私空间解锁框：安全密码 / 邮箱验证码 二选一；未设密码走首次设置；忘记密码走验证码重置 */
export default function PrivacyUnlockDialog({
	open,
	onOpenChange,
	onUnlocked,
}: PrivacyUnlockDialogProps) {
	const [view, setView] = useState<View>('unlock')
	const [password, setPassword] = useState('')
	const [confirmPassword, setConfirmPassword] = useState('')
	const [newPassword, setNewPassword] = useState('')
	const [code, setCode] = useState('')
	const [submitting, setSubmitting] = useState(false)
	const [sending, setSending] = useState(false)
	const [countdown, setCountdown] = useState(0)
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

	useEffect(() => {
		return () => {
			if (timerRef.current) clearInterval(timerRef.current)
		}
	}, [])

	// 打开时重置表单，并按是否已设安全密码决定初始视图
	useEffect(() => {
		if (!open) return
		setPassword('')
		setConfirmPassword('')
		setNewPassword('')
		setCode('')
		getPrivacyStatus()
			.then((res) => {
				setView(res.success && res.data?.hasSecurityPassword ? 'unlock' : 'setup')
			})
			.catch(() => setView('unlock'))
	}, [open])

	const startCountdown = () => {
		setCountdown(RESEND_COUNTDOWN)
		timerRef.current = setInterval(() => {
			setCountdown((n) => {
				if (n <= 1 && timerRef.current) {
					clearInterval(timerRef.current)
					timerRef.current = null
				}
				return Math.max(0, n - 1)
			})
		}, 1000)
	}

	const handleSendCode = async () => {
		setSending(true)
		try {
			const res = await sendPrivacyCode()
			if (res.success) {
				toast.success('验证码已发送到你账号绑定的邮箱')
				startCountdown()
			} else {
				toast.error(res.message || '发送失败')
			}
		} catch (err: any) {
			toast.error(err?.response?.data?.message || '验证码发送失败，请稍后重试')
		} finally {
			setSending(false)
		}
	}

	const handleUnlock = async (params: { password?: string; code?: string }) => {
		setSubmitting(true)
		try {
			const res = await unlockPrivacy(params)
			if (res.success && res.data?.token) {
				setPrivacyToken(res.data.token)
				toast.success('隐私空间已解锁，本次会话内免密')
				onOpenChange(false)
				onUnlocked()
			} else {
				toast.error(res.message || '解锁失败')
			}
		} catch (err: any) {
			toast.error(err?.response?.data?.message || '解锁失败')
		} finally {
			setSubmitting(false)
		}
	}

	const handleSetup = async () => {
		if (password.length < 6) {
			toast.error('安全密码至少 6 位')
			return
		}
		if (password !== confirmPassword) {
			toast.error('两次输入的密码不一致')
			return
		}
		setSubmitting(true)
		try {
			const res = await setupPrivacyPassword(password)
			if (res.success && res.data?.token) {
				setPrivacyToken(res.data.token)
				toast.success('安全密码设置成功，隐私空间已解锁')
				onOpenChange(false)
				onUnlocked()
			} else {
				toast.error(res.message || '设置失败')
			}
		} catch (err: any) {
			toast.error(err?.response?.data?.message || '设置失败')
		} finally {
			setSubmitting(false)
		}
	}

	const handleReset = async () => {
		if (!code.trim()) {
			toast.error('请输入验证码')
			return
		}
		if (newPassword.length < 6) {
			toast.error('安全密码至少 6 位')
			return
		}
		setSubmitting(true)
		try {
			const res = await resetPrivacyPassword(code.trim(), newPassword)
			if (res.success) {
				toast.success('安全密码已重置，请使用新密码解锁')
				setCode('')
				setNewPassword('')
				setView('unlock')
			} else {
				toast.error(res.message || '重置失败')
			}
		} catch (err: any) {
			toast.error(err?.response?.data?.message || '重置失败')
		} finally {
			setSubmitting(false)
		}
	}

	const sendCodeButton = (
		<Button
			variant="outline"
			className="w-full gap-2"
			onClick={handleSendCode}
			disabled={sending || countdown > 0}
		>
			{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
			{countdown > 0 ? `重新发送（${countdown}s）` : '发送验证码到邮箱'}
		</Button>
	)

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-sm">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Lock className="h-4 w-4" />
						{view === 'setup' ? '设置安全密码' : view === 'reset' ? '重置安全密码' : '解锁隐私空间'}
					</DialogTitle>
					<DialogDescription className="text-xs leading-relaxed">
						{view === 'setup'
							? '首次使用隐私文件夹需要设置安全密码（至少 6 位，不能与登录密码相同）。'
							: '解锁后本次会话（当前标签页）内访问隐私文件夹免密，12 小时后自动失效。'}
					</DialogDescription>
				</DialogHeader>

				{view === 'setup' && (
					<div className="space-y-3">
						<div className="space-y-1.5">
							<Label htmlFor="privacy-setup-password">安全密码</Label>
							<Input
								id="privacy-setup-password"
								type="password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								placeholder="至少 6 位"
							/>
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="privacy-setup-confirm">确认密码</Label>
							<Input
								id="privacy-setup-confirm"
								type="password"
								value={confirmPassword}
								onChange={(e) => setConfirmPassword(e.target.value)}
								onKeyDown={(e) => e.key === 'Enter' && handleSetup()}
								placeholder="再次输入"
							/>
						</div>
						<Button className="w-full" onClick={handleSetup} disabled={submitting}>
							{submitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
							设置并解锁
						</Button>
					</div>
				)}

				{view === 'unlock' && (
					<Tabs defaultValue="password">
						<TabsList className="grid w-full grid-cols-2">
							<TabsTrigger value="password">安全密码</TabsTrigger>
							<TabsTrigger value="code">邮箱验证码</TabsTrigger>
						</TabsList>
						<TabsContent value="password" className="space-y-3 pt-3">
							<Input
								type="password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								onKeyDown={(e) => e.key === 'Enter' && handleUnlock({ password })}
								placeholder="输入安全密码"
							/>
							<Button
								className="w-full"
								onClick={() => handleUnlock({ password })}
								disabled={submitting || !password}
							>
								{submitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
								解锁
							</Button>
							<button
								type="button"
								className="w-full text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
								onClick={() => setView('reset')}
							>
								忘记安全密码？用邮箱验证码重置
							</button>
						</TabsContent>
						<TabsContent value="code" className="space-y-3 pt-3">
							{sendCodeButton}
							<div className="flex gap-2">
								<Input
									value={code}
									onChange={(e) => setCode(e.target.value)}
									onKeyDown={(e) => e.key === 'Enter' && handleUnlock({ code: code.trim() })}
									placeholder="输入 6 位验证码"
									maxLength={6}
									className="flex-1 text-center tracking-widest"
								/>
								<Button
									onClick={() => handleUnlock({ code: code.trim() })}
									disabled={submitting || !code.trim()}
								>
									{submitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
									解锁
								</Button>
							</div>
						</TabsContent>
					</Tabs>
				)}

				{view === 'reset' && (
					<div className="space-y-3">
						{sendCodeButton}
						<div className="space-y-1.5">
							<Label htmlFor="privacy-reset-code">验证码</Label>
							<Input
								id="privacy-reset-code"
								value={code}
								onChange={(e) => setCode(e.target.value)}
								placeholder="输入 6 位验证码"
								maxLength={6}
								className="text-center tracking-widest"
							/>
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="privacy-reset-password">新安全密码</Label>
							<Input
								id="privacy-reset-password"
								type="password"
								value={newPassword}
								onChange={(e) => setNewPassword(e.target.value)}
								onKeyDown={(e) => e.key === 'Enter' && handleReset()}
								placeholder="至少 6 位"
							/>
						</div>
						<Button className="w-full" onClick={handleReset} disabled={submitting}>
							{submitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
							重置安全密码
						</Button>
						<button
							type="button"
							className="w-full text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
							onClick={() => setView('unlock')}
						>
							返回解锁
						</button>
					</div>
				)}
			</DialogContent>
		</Dialog>
	)
}
