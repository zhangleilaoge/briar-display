'use client'

import UserMenu from '@/components/common/UserMenu'
import { Card, CardContent } from '@/components/ui/card'
import { PermissionProvider, usePermissions } from '@/contexts/PermissionContext'
import { cn } from '@/lib/utils'
import { BookOpen, ImageIcon, Shield, Wrench } from 'lucide-react'

/**
 * 科幻流体背景动画：三个光斑做形变 + 漂移（只动 transform/border-radius，不走重排）
 * 配色收敛在 青 → 蓝 → 紫 一个冷色族内，避免杂乱
 */
const PORTAL_STYLE = `
.portal-blob {
	position: absolute;
	filter: blur(100px);
	will-change: transform, border-radius;
}
.portal-blob-1 {
	left: -15%; top: -20%; width: 55vw; height: 55vw;
	background: rgba(34, 211, 238, 0.22);
	animation: portal-drift-a 28s ease-in-out infinite alternate;
}
.portal-blob-2 {
	right: -12%; top: 5%; width: 48vw; height: 48vw;
	background: rgba(139, 92, 246, 0.19);
	animation: portal-drift-b 34s ease-in-out infinite alternate;
}
.portal-blob-3 {
	left: 28%; bottom: -18%; width: 45vw; height: 45vw;
	background: rgba(59, 130, 246, 0.17);
	animation: portal-drift-c 24s ease-in-out infinite alternate;
}
@keyframes portal-drift-a {
	0% { transform: translate(0, 0) scale(1); border-radius: 58% 42% 55% 45% / 50% 60% 40% 50%; }
	50% { transform: translate(7vw, 6vh) scale(1.15); border-radius: 42% 58% 40% 60% / 60% 42% 58% 40%; }
	100% { transform: translate(-3vw, 4vh) scale(0.92); border-radius: 55% 45% 62% 38% / 42% 58% 45% 55%; }
}
@keyframes portal-drift-b {
	0% { transform: translate(0, 0) scale(1); border-radius: 45% 55% 60% 40% / 55% 45% 60% 40%; }
	50% { transform: translate(-6vw, 8vh) scale(1.1); border-radius: 60% 40% 42% 58% / 45% 60% 40% 55%; }
	100% { transform: translate(4vw, -3vh) scale(0.95); border-radius: 40% 60% 55% 45% / 60% 40% 58% 42%; }
}
@keyframes portal-drift-c {
	0% { transform: translate(0, 0) scale(1); border-radius: 50% 50% 45% 55% / 60% 40% 60% 40%; }
	50% { transform: translate(5vw, -6vh) scale(1.12); border-radius: 40% 60% 58% 42% / 45% 55% 45% 55%; }
	100% { transform: translate(-5vw, 2vh) scale(0.94); border-radius: 62% 38% 50% 50% / 42% 58% 40% 60%; }
}
.portal-grid {
	background-image:
		linear-gradient(rgba(148, 163, 184, 0.055) 1px, transparent 1px),
		linear-gradient(90deg, rgba(148, 163, 184, 0.055) 1px, transparent 1px);
	background-size: 44px 44px;
	-webkit-mask-image: radial-gradient(ellipse 90% 80% at 50% 40%, black 20%, transparent 75%);
	mask-image: radial-gradient(ellipse 90% 80% at 50% 40%, black 20%, transparent 75%);
}
@media (prefers-reduced-motion: reduce) {
	.portal-blob { animation: none; }
}
`

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
			<Card className="rounded-xl border border-white/[0.12] bg-white/[0.06] backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/40 hover:bg-white/[0.09] hover:shadow-[0_0_45px_-10px_rgba(56,189,248,0.4)]">
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
						<h3 className="text-base font-medium text-zinc-100 transition-colors group-hover:text-cyan-300">
							{title}
						</h3>
						<p className="mt-0.5 text-sm text-zinc-500">{description}</p>
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
			<style>{PORTAL_STYLE}</style>

			{/* 流体光斑背景（底色必须在这层，不能放根节点——负 z-index 会被根背景盖住） */}
			<div className="pointer-events-none fixed inset-0 -z-20 overflow-hidden bg-[#04070f]">
				<div className="portal-blob portal-blob-1" />
				<div className="portal-blob portal-blob-2" />
				<div className="portal-blob portal-blob-3" />
			</div>

			{/* 科技网格（中心亮、边缘淡出） */}
			<div className="portal-grid pointer-events-none fixed inset-0 -z-10" />

			{/* Top bar */}
			<header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-white/[0.06] bg-[#04070f]/70 px-6 backdrop-blur-md">
				<span className="text-base font-semibold tracking-tight text-zinc-100">Briar</span>
				<div className="flex items-center gap-3">
					{loading ? (
						<div className="h-4 w-16 animate-pulse rounded bg-white/10" />
					) : (
						<UserMenu variant="dark" />
					)}
				</div>
			</header>

			{/* Main */}
			<main className="flex flex-1 items-center justify-center p-6">
				<div className="w-full max-w-2xl space-y-8">
					{/* Hero */}
					<div className="space-y-3 text-center">
						<h1 className="bg-gradient-to-br from-cyan-300 via-sky-400 to-violet-400 bg-clip-text text-5xl font-bold tracking-tight text-transparent drop-shadow-[0_0_25px_rgba(56,189,248,0.35)]">
							Briar
						</h1>
						<p className="text-lg text-zinc-400">选择一个模块开始</p>
					</div>

					{/* Bento grid */}
					<div className="grid gap-4 sm:grid-cols-2">
						<EntryCard
							icon={<BookOpen className="h-5 w-5" />}
							title="Wiki"
							description="知识库与文档管理"
							href="/briar-display/wiki/"
							gradient="from-cyan-400 to-blue-500"
						/>
						<EntryCard
							icon={<Wrench className="h-5 w-5" />}
							title="工具箱"
							description="文件 Diff、图片压缩等实用工具"
							href="/briar-display/tools/diff"
							gradient="from-sky-400 to-indigo-500"
						/>
						<EntryCard
							icon={<ImageIcon className="h-5 w-5" />}
							title="图床"
							description="图片上传与相册管理"
							href="/briar-display/images/gallery"
							gradient="from-teal-400 to-cyan-600"
						/>
						{!loading && isAdmin && (
							<EntryCard
								icon={<Shield className="h-5 w-5" />}
								title="管理后台"
								description="角色权限与用户管理"
								href="/briar-display/admin/permissions"
								gradient="from-violet-400 to-purple-600"
							/>
						)}
					</div>
				</div>
			</main>

			{/* Footer */}
			<footer className="pb-6 pt-8 text-center text-xs text-zinc-600">Powered by Briar</footer>
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
