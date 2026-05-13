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
import { type FormEvent, useState } from 'react'

export default function RegisterPage() {
	const [firstName, setFirstName] = useState('')
	const [lastName, setLastName] = useState('')
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')
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
				setAuthToken(result.data.token)
				window.location.href = '/briar-display/business'
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
		<div className="min-h-screen bg-[radial-gradient(circle_at_top,_hsl(var(--accent))_0%,_hsl(var(--background))_60%)]">
			<div className="container flex min-h-screen items-center justify-center">
				<div className="grid w-full max-w-5xl gap-8 lg:grid-cols-[0.9fr_1.1fr]">
					<Card className="order-2 lg:order-1">
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
										<Input
											id="password"
											type="password"
											placeholder="至少 8 位"
											value={password}
											onChange={(event) => setPassword(event.target.value)}
											required
										/>
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
									<a href="/briar-display/login" className="text-primary hover:underline">
										返回登录
									</a>
								</p>
							</CardFooter>
						</form>
					</Card>

					<div className="order-1 flex flex-col justify-center gap-6 lg:order-2">
						<div className="space-y-3">
							<p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">
								Briar Launchpad
							</p>
							<h1 className="text-4xl font-semibold leading-tight">让流程自动化，从注册开始</h1>
							<p className="text-lg text-muted-foreground">
								连接业务系统、统一工作流、实时追踪 KPI。
							</p>
						</div>
						<div className="grid gap-3 sm:grid-cols-2">
							<div className="rounded-xl border border-border/60 bg-card/60 p-4">
								<p className="text-sm text-muted-foreground">模版数量</p>
								<p className="text-2xl font-semibold">34</p>
								<p className="text-xs text-muted-foreground">可用流程</p>
							</div>
							<div className="rounded-xl border border-border/60 bg-card/60 p-4">
								<p className="text-sm text-muted-foreground">平均部署</p>
								<p className="text-2xl font-semibold">12 分钟</p>
								<p className="text-xs text-muted-foreground">从创建到上线</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
