'use client'

import { wikiApi } from '@/api/wiki'
import WikiBreadcrumbs from '@/components/wiki/common/WikiBreadcrumbs'
import { cn } from '@/lib/utils'
import type { WikiStatistics as WikiStats } from '@briar/shared'
import { BarChart3, Clock, FileText, FolderTree, LayoutList, Loader2, Users } from 'lucide-react'
import { useEffect, useState } from 'react'

interface StatCardProps {
	icon: React.ReactNode
	label: string
	value: number
	href?: string
	className?: string
}

function StatCard({ icon, label, value, href, className }: StatCardProps) {
	const content = (
		<div
			className={cn(
				'flex items-center gap-4 rounded-lg border border-border bg-white p-4 shadow-sm transition-shadow hover:shadow-md',
				href && 'cursor-pointer',
				className,
			)}
		>
			<div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
				{icon}
			</div>
			<div>
				<p className="font-serif text-2xl font-normal text-foreground">{value.toLocaleString()}</p>
				<p className="text-muted-foreground text-sm">{label}</p>
			</div>
		</div>
	)

	if (!href) {
		return content
	}

	return (
		<a
			href={href}
			onClick={(e) => {
				e.preventDefault()
				window.history.pushState({}, '', href)
				window.dispatchEvent(new PopStateEvent('popstate'))
			}}
			className="block"
		>
			{content}
		</a>
	)
}

export default function WikiStatistics() {
	const [stats, setStats] = useState<WikiStats | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		const fetchStats = async () => {
			const res = await wikiApi.statistics()
			if (res.success && res.data) {
				setStats(res.data)
			} else {
				setError(res.message || '加载统计数据失败')
			}
			setLoading(false)
		}
		fetchStats()
	}, [])

	return (
		<div className="space-y-4">
			<WikiBreadcrumbs items={[{ label: '统计' }]} />

			<h2 className="flex items-center gap-2 font-serif text-xl font-normal text-foreground">
				<BarChart3 className="h-5 w-5" />
				站点统计
			</h2>

			{loading ? (
				<div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
					<Loader2 className="h-5 w-5 animate-spin" />
					加载中...
				</div>
			) : error ? (
				<div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-sm">
					{error}
				</div>
			) : stats ? (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					<StatCard
						icon={<FileText className="h-6 w-6" />}
						label="总页面数"
						value={stats.totalPages}
						href="/briar-display/wiki/special/all-pages"
					/>
					<StatCard
						icon={<FileText className="h-6 w-6" />}
						label="文章数"
						value={stats.totalArticles}
						href="/briar-display/wiki/"
					/>
					<StatCard
						icon={<Clock className="h-6 w-6" />}
						label="总修订数"
						value={stats.totalRevisions}
						href="/briar-display/wiki/special/recent-changes"
					/>
					<StatCard
						icon={<FolderTree className="h-6 w-6" />}
						label="分类数"
						value={stats.totalCategories}
						href="/briar-display/wiki/categories"
					/>
					<StatCard
						icon={<LayoutList className="h-6 w-6" />}
						label="模板数"
						value={stats.totalTemplates}
						href="/briar-display/wiki/special/templates"
					/>
					<StatCard
						icon={<Users className="h-6 w-6" />}
						label="注册用户"
						value={stats.totalUsers}
					/>
					<div className="sm:col-span-2 lg:col-span-3">
						<a
							href="/briar-display/wiki/special/recent-changes"
							onClick={(e) => {
								e.preventDefault()
								window.history.pushState({}, '', '/briar-display/wiki/special/recent-changes')
								window.dispatchEvent(new PopStateEvent('popstate'))
							}}
							className="block"
						>
							<div className="rounded-lg border border-primary/30 bg-primary/5 p-4 transition-shadow hover:shadow-md">
								<div className="flex items-center gap-3">
									<div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-primary/20 text-primary">
										<Clock className="h-6 w-6" />
									</div>
									<div>
										<p className="font-serif text-2xl font-normal text-foreground">
											{stats.recentEdits24h.toLocaleString()}
										</p>
										<p className="text-muted-foreground text-sm">最近 24 小时编辑次数</p>
									</div>
								</div>
							</div>
						</a>
					</div>
				</div>
			) : null}
		</div>
	)
}
