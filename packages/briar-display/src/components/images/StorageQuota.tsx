'use client'

import { type ImageStats, getImageStats } from '@/api/images'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
	if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
	return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export default function StorageQuota() {
	const [stats, setStats] = useState<ImageStats | null>(null)

	useEffect(() => {
		getImageStats()
			.then((res) => {
				if (res.success && res.data) setStats(res.data)
			})
			.catch(() => {})
	}, [])

	if (!stats) return null

	const percent = Math.min(100, Math.round((stats.used / stats.quota) * 100))
	const colorClass = percent >= 90 ? 'bg-red-500' : percent >= 70 ? 'bg-yellow-500' : 'bg-green-500'

	return (
		<div className="flex items-center gap-3">
			<div className="flex items-center gap-2">
				<div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
					<div
						className={cn('h-full rounded-full transition-all', colorClass)}
						style={{ width: `${percent}%` }}
					/>
				</div>
				<span className="whitespace-nowrap text-xs text-muted-foreground">
					{formatBytes(stats.used)} / {formatBytes(stats.quota)}
				</span>
			</div>
			<span className="text-xs text-muted-foreground">{stats.count} 张</span>
		</div>
	)
}
