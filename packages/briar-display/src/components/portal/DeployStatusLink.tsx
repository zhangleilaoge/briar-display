'use client'

import { type DeployHistoryItem, getDeployHistory } from '@/api/deploy'
import { type SiteVersion, getSiteVersion } from '@/api/version'
import { buttonVariants } from '@/components/ui/button'
import { usePermissions } from '@/contexts/PermissionContext'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'
import { buildDeployStatus, isCdnDeploy, isDeployRunning } from './deployStatus'

export function DeployStatusLink() {
	const { isAdmin, loading } = usePermissions()
	const [version, setVersion] = useState<SiteVersion | null>(null)
	const [latest, setLatest] = useState<DeployHistoryItem | null>(null)
	const [now, setNow] = useState(() => Date.now())

	useEffect(() => {
		if (loading || !isAdmin) {
			setVersion(null)
			setLatest(null)
			return
		}

		let cancelled = false
		let timer: ReturnType<typeof setTimeout> | undefined
		const refresh = async () => {
			const [versionRes, historyRes] = await Promise.all([
				getSiteVersion().catch(() => null),
				getDeployHistory().catch(() => null),
			])
			if (cancelled) return
			const nextLatest = historyRes?.success
				? (historyRes.data?.items.find(isCdnDeploy) ?? null)
				: null
			setVersion(versionRes?.success ? (versionRes.data ?? null) : null)
			setLatest(nextLatest)
			setNow(Date.now())
			timer = setTimeout(refresh, nextLatest && isDeployRunning(nextLatest.status) ? 10000 : 60000)
		}
		void refresh()
		return () => {
			cancelled = true
			if (timer) clearTimeout(timer)
		}
	}, [isAdmin, loading])

	useEffect(() => {
		const timer = setInterval(() => setNow(Date.now()), 30000)
		return () => clearInterval(timer)
	}, [])

	if (loading || !isAdmin) return null
	const status = buildDeployStatus(version, latest, now)
	if (!status) return null

	return (
		<div className="absolute right-4 top-[4.5rem] z-40 flex max-w-[calc(100%-6rem)] items-center gap-1.5 px-2 py-1 text-xs font-normal text-muted-foreground sm:right-6">
			<span aria-hidden>{status.light}</span>
			<a
				href={status.href}
				target="_blank"
				rel="noopener noreferrer"
				title={`${status.fullCommit}\n${status.label} · 在 GitHub Actions 查看`}
				aria-label={`部署状态：${status.label}，commit ${status.fullCommit}，在 GitHub Actions 查看`}
				className={cn(
					buttonVariants({ variant: 'link', size: 'sm' }),
					'h-auto shrink-0 px-0 py-0 font-mono text-xs font-normal text-muted-foreground hover:text-foreground',
				)}
			>
				{status.commit}
			</a>
			<span aria-hidden>·</span>
			<span className="truncate">{status.label}</span>
		</div>
	)
}
