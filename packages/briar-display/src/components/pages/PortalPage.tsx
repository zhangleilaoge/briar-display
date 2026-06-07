'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { usePermissions } from '@/contexts/PermissionContext'
import { BookOpen, FileDiff, ImageIcon, LogIn, LogOut, Shield, Wrench } from 'lucide-react'

interface EntryCardProps {
	icon: React.ReactNode
	title: string
	description: string
	href: string
}

function EntryCard({ icon, title, description, href }: EntryCardProps) {
	return (
		<a href={href} className="group block">
			<Card className="transition-shadow hover:shadow-md">
				<CardContent className="flex items-start gap-4 p-5">
					<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
						{icon}
					</div>
					<div className="min-w-0">
						<h3 className="text-base font-medium group-hover:text-primary">{title}</h3>
						<p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
					</div>
				</CardContent>
			</Card>
		</a>
	)
}

export default function PortalPage() {
	const { isLoggedIn, isAdmin, user, loading } = usePermissions()

	const handleLogout = () => {
		localStorage.removeItem('briar_token')
		localStorage.removeItem('briar_user')
		localStorage.removeItem('briar_permissions')
		window.location.reload()
	}

	return (
		<div className="flex min-h-screen flex-col bg-[radial-gradient(circle_at_top,_hsl(var(--muted))_0%,_hsl(var(--background))_55%)]">
			{/* 顶栏 */}
			<header className="flex h-14 items-center justify-between border-b bg-background/80 px-6 backdrop-blur">
				<span className="text-base font-semibold">Briar</span>
				<div className="flex items-center gap-3">
					{loading ? (
						<div className="h-4 w-16 animate-pulse rounded bg-muted" />
					) : isLoggedIn ? (
						<>
							<span className="text-sm text-muted-foreground">{user?.name}</span>
							<Button variant="ghost" size="sm" onClick={handleLogout} className="gap-1.5">
								<LogOut className="h-4 w-4" />
								退出
							</Button>
						</>
					) : (
						<a href="/briar-display/login">
							<Button variant="outline" size="sm" className="gap-1.5">
								<LogIn className="h-4 w-4" />
								登录
							</Button>
						</a>
					)}
				</div>
			</header>

			{/* 主体 */}
			<main className="flex flex-1 items-center justify-center p-6">
				<div className="w-full max-w-2xl space-y-8">
					<div className="text-center">
						<h1 className="text-3xl font-semibold tracking-tight">Briar</h1>
						<p className="mt-2 text-muted-foreground">选择一个模块开始</p>
					</div>

					<div className="grid gap-4 sm:grid-cols-2">
						<EntryCard
							icon={<BookOpen className="h-5 w-5" />}
							title="Wiki"
							description="知识库与文档管理"
							href="/briar-display/wiki/"
						/>
						<EntryCard
							icon={<Wrench className="h-5 w-5" />}
							title="工具箱"
							description="文件 Diff、图片压缩等实用工具"
							href="/briar-display/tools/diff"
						/>
						{!loading && isAdmin && (
							<EntryCard
								icon={<Shield className="h-5 w-5" />}
								title="管理后台"
								description="角色权限与用户管理"
								href="/briar-display/admin/permissions"
							/>
						)}
					</div>
				</div>
			</main>
		</div>
	)
}
