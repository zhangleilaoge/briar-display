'use client'

import UserMenu from '@/components/common/UserMenu'
import { Card, CardContent } from '@/components/ui/card'
import { PermissionProvider, usePermissions } from '@/contexts/PermissionContext'
import { cn } from '@/lib/utils'
import { BookOpen, ImageIcon, Shield, Wrench } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type WebGLFluidEnhanced from 'webgl-fluid-enhanced'

/** 科技网格（中心亮、边缘淡出），叠在流体画布之上 */
const PORTAL_STYLE = `
.portal-grid {
	background-image:
		linear-gradient(rgba(148, 163, 184, 0.05) 1px, transparent 1px),
		linear-gradient(90deg, rgba(148, 163, 184, 0.05) 1px, transparent 1px);
	background-size: 44px 44px;
	-webkit-mask-image: radial-gradient(ellipse 90% 80% at 50% 40%, black 20%, transparent 75%);
	mask-image: radial-gradient(ellipse 90% 80% at 50% 40%, black 20%, transparent 75%);
}
`

/** 无操作时每隔 3s 自动注入一团流体，保持画面流动 */
const IDLE_SPLAT_INTERVAL = 3000

/**
 * WebGL 流体背景（webgl-fluid-enhanced，MIT，基于 PavelDoGreat 的流体模拟）
 * 配色收敛在 青 → 蓝 → 紫 冷色族内，鼠标移动可搅动流体
 */
function useFluidBackground(containerRef: React.RefObject<HTMLDivElement | null>) {
	useEffect(() => {
		const container = containerRef.current
		if (!container) return
		let instance: WebGLFluidEnhanced | null = null
		let timer: ReturnType<typeof setInterval> | null = null
		let onMouseMove: ((e: MouseEvent) => void) | null = null
		let disposed = false

		// 动态导入：避免 SSR 阶段触碰 window/document
		import('webgl-fluid-enhanced').then(({ default: WebGLFluidEnhanced }) => {
			if (disposed) return
			instance = new WebGLFluidEnhanced(container)
			instance.setConfig({
				// 透明画布，透出下层深空底色；青→蓝→紫三色系
				transparent: true,
				colorPalette: ['#22d3ee', '#3b82f6', '#8b5cf6'],
				colorful: false,
				brightness: 0.55,
				// 染料消散快一点，画面干净不糊；速度消散慢一点，流动感更持久
				densityDissipation: 2.2,
				velocityDissipation: 0.4,
				curl: 20,
				splatRadius: 0.3,
				// 去掉泛光/日光，避免发白发乱
				bloom: false,
				sunrays: false,
			})
			instance.start()
			// 开场多来几团，随后周期性注入保持流动
			instance.multipleSplats(6)
			timer = setInterval(() => instance?.multipleSplats(1), IDLE_SPLAT_INTERVAL)

			// 鼠标搅动：库的 hover 监听挂在 canvas 上，但画布在负 z-index 层收不到事件，
			// 改为在 window 上监听并手动注入 splat（x 乘 pixelRatio 对齐库内部算法，
			// y 方向翻转——纹理坐标系 y 轴向上）
			let lastX = 0
			let lastY = 0
			onMouseMove = (e: MouseEvent) => {
				if (!instance) return
				const dx = (e.clientX - lastX) * 10
				const dy = (e.clientY - lastY) * 10
				lastX = e.clientX
				lastY = e.clientY
				if (dx === 0 && dy === 0) return
				const clamp = (v: number) => Math.max(-600, Math.min(600, v))
				instance.splatAtLocation(
					e.clientX * (window.devicePixelRatio || 1),
					e.clientY,
					clamp(dx),
					clamp(-dy),
				)
			}
			window.addEventListener('mousemove', onMouseMove)
		})

		return () => {
			disposed = true
			if (timer) clearInterval(timer)
			if (onMouseMove) window.removeEventListener('mousemove', onMouseMove)
			instance?.stop()
		}
	}, [containerRef])
}

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
	const fluidRef = useRef<HTMLDivElement>(null)
	useFluidBackground(fluidRef)

	return (
		<div className="relative flex min-h-screen flex-col overflow-hidden">
			<style>{PORTAL_STYLE}</style>

			{/* WebGL 流体画布（底色必须在这层，不能放根节点——负 z-index 会被根背景盖住）
			    不加 pointer-events-none，鼠标划过背景可搅动流体。
			    注意：webgl-fluid-enhanced 会给传入容器强制写内联 position:relative，
			    所以 fixed 定位放外层，库只作用于内层 wrapper */}
			<div className="fixed inset-0 -z-20 overflow-hidden bg-[#04070f]">
				<div ref={fluidRef} className="h-full w-full" />
			</div>

			{/* 科技网格（中心亮、边缘淡出） */}
			<div className="portal-grid pointer-events-none fixed inset-0 -z-10" />

			{/* Top bar */}
			<header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-white/10 bg-white/[0.05] px-6 shadow-[0_1px_24px_-8px_rgba(56,189,248,0.25)] backdrop-blur-md">
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
