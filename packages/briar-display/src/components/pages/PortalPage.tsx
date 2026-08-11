'use client'

import UserMenu from '@/components/common/UserMenu'
import { Card, CardContent } from '@/components/ui/card'
import { PermissionProvider, usePermissions } from '@/contexts/PermissionContext'
import { cn } from '@/lib/utils'
import { BookOpen, Folder, Shield, Wrench } from 'lucide-react'

interface EntryCardProps {
	icon: React.ReactNode
	title: string
	description: string
	href: string
	gradient: string
}

function EntryCard({ icon, title, description, href, gradient }: EntryCardProps) {
	return (
		<a href={href} className="group block">
			<Card className="bg-card/60 backdrop-blur-sm border border-border/50 rounded-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
				<CardContent className="flex items-start gap-4 p-5">
					<div
						className={cn(
							'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md',
							gradient,
						)}
					>
						{icon}
					</div>
					<div className="min-w-0">
						<h3 className="text-base font-medium group-hover:text-primary transition-colors">
							{title}
						</h3>
						<p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
					</div>
				</CardContent>
			</Card>
		</a>
	)
}

function PortalPageInner() {
	const { isAdmin, loading } = usePermissions()

	return (
		<div className="relative flex min-h-screen flex-col overflow-hidden">
			{/* Mesh gradient background */}
			<div className="pointer-events-none fixed inset-0 -z-20">
				<div className="absolute inset-0 bg-background" />
				<div className="absolute -left-[20%] -top-[20%] h-[60%] w-[60%] rounded-full bg-blue-500/20 blur-[120px]" />
				<div className="absolute -right-[10%] top-[10%] h-[50%] w-[50%] rounded-full bg-purple-500/20 blur-[120px]" />
				<div className="absolute bottom-[5%] left-[30%] h-[40%] w-[40%] rounded-full bg-teal-500/15 blur-[100px]" />
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

			{/* Top bar */}
			<header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border/50 bg-background/60 px-6 backdrop-blur-md">
				<span className="text-base font-semibold tracking-tight">Briar</span>
				<div className="flex items-center gap-3">
					{loading ? (
						<div className="h-4 w-16 animate-pulse rounded bg-muted" />
					) : (
						<UserMenu variant="light" />
					)}
				</div>
			</header>

			{/* Main */}
			<main className="flex flex-1 items-center justify-center p-6">
				<div className="w-full max-w-2xl space-y-8">
					{/* Hero */}
					<div className="text-center space-y-3">
						<h1 className="bg-gradient-to-br from-blue-600 via-purple-600 to-teal-500 bg-clip-text text-5xl font-bold tracking-tight text-transparent">
							Briar
						</h1>
						<p className="text-lg text-muted-foreground">选择一个模块开始</p>
					</div>

					{/* Bento grid */}
					<div className="grid gap-4 sm:grid-cols-2">
						<EntryCard
							icon={<BookOpen className="h-5 w-5" />}
							title="Wiki"
							description="知识库与文档管理"
							href="/briar/wiki/"
							gradient="from-blue-500 to-purple-500"
						/>
						<EntryCard
							icon={<Wrench className="h-5 w-5" />}
							title="工具箱"
							description="文件 Diff、图片压缩等实用工具"
							href="/briar/tools/diff"
							gradient="from-teal-500 to-emerald-500"
						/>
						<EntryCard
							icon={<Folder className="h-5 w-5" />}
							title="文件"
							description="文件、图片与视频的云端管理"
							href="/briar/files"
							gradient="from-pink-500 to-rose-500"
						/>
						{!loading && isAdmin && (
							<EntryCard
								icon={<Shield className="h-5 w-5" />}
								title="管理后台"
								description="角色权限与用户管理"
								href="/briar/admin/permissions"
								gradient="from-amber-500 to-orange-500"
							/>
						)}
					</div>
				</div>
			</main>

			{/* Footer */}
			<footer className="pb-6 pt-8 text-center text-xs text-muted-foreground/60">
				Powered by Briar
			</footer>
		</div>
	)
}

export default function PortalPage() {
	return (
		<PermissionProvider>
			<PortalPageInner />
		</PermissionProvider>
	)
}
