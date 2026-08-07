'use client'

import { sendTerminalCode, verifyTerminalDevice } from '@/api/terminal'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Loader2, Mail, ShieldCheck } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

const RESEND_COUNTDOWN = 60

interface DeviceGateProps {
	onVerified: (token: string) => void
}

/** SSH 控制台设备验证门：邮箱验证码换取 7 天设备授权 */
export default function DeviceGate({ onVerified }: DeviceGateProps) {
	const [code, setCode] = useState('')
	const [sending, setSending] = useState(false)
	const [verifying, setVerifying] = useState(false)
	const [countdown, setCountdown] = useState(0)
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

	useEffect(() => {
		return () => {
			if (timerRef.current) clearInterval(timerRef.current)
		}
	}, [])

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

	const handleSend = async () => {
		setSending(true)
		try {
			const res = await sendTerminalCode()
			if (res.success) {
				toast.success('验证码已发送到你账号绑定的邮箱')
				startCountdown()
			} else {
				toast.error(res.message || '发送失败')
			}
		} catch {
			toast.error('验证码发送失败，请稍后重试')
		} finally {
			setSending(false)
		}
	}

	const handleVerify = async () => {
		const trimmed = code.trim()
		if (!trimmed) {
			toast.error('请输入验证码')
			return
		}
		setVerifying(true)
		try {
			const res = await verifyTerminalDevice(trimmed)
			if (res.success && res.data?.token) {
				toast.success('设备授权成功，7 天内本机可直接使用 SSH 控制台')
				onVerified(res.data.token)
			} else {
				toast.error(res.message || '验证码错误或已过期')
			}
		} catch {
			toast.error('验证码错误或已过期')
		} finally {
			setVerifying(false)
		}
	}

	return (
		<div className="flex items-center justify-center py-16">
			<Card className="w-full max-w-md">
				<CardHeader className="items-center text-center">
					<div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
						<ShieldCheck className="h-6 w-6 text-primary" />
					</div>
					<CardTitle className="text-base">设备安全验证</CardTitle>
					<CardDescription className="text-xs leading-relaxed">
						SSH 控制台直连生产服务器，每次在新设备使用前需要通过邮箱验证码授权。 授权后本设备 7
						天内免验证。
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3">
					<Button
						variant="outline"
						className="w-full gap-2"
						onClick={handleSend}
						disabled={sending || countdown > 0}
					>
						{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
						{countdown > 0 ? `重新发送（${countdown}s）` : '发送验证码到邮箱'}
					</Button>
					<div className="flex gap-2">
						<Input
							value={code}
							onChange={(e) => setCode(e.target.value)}
							onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
							placeholder="输入 6 位验证码"
							maxLength={6}
							className="flex-1 text-center tracking-widest"
						/>
						<Button onClick={handleVerify} disabled={verifying} className="gap-1.5">
							{verifying && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
							验证并进入
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	)
}
