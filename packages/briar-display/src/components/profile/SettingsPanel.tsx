'use client'

import { ProfileSheet, ProfileSheetHeader } from '@/components/profile/ProfileSheet'
import { RibbonSettingsCard } from '@/components/profile/RibbonSettingsCard'
import { TOOLS_NAV_ITEMS } from '@/components/tools/ToolsLayout'
import { useToolsVisibility } from '@/components/tools/useToolsVisibility'
import { Switch } from '@/components/ui/switch'
import { Wrench } from 'lucide-react'

export default function SettingsPanel() {
	return (
		<div className="space-y-6">
			<RibbonSettingsCard />
			<ToolsSettingsCard />
		</div>
	)
}

function ToolsSettingsCard() {
	const { hidden, canEdit, setToolVisible } = useToolsVisibility()
	const hiddenSet = new Set(hidden)
	const visibleCount = TOOLS_NAV_ITEMS.filter((item) => !hiddenSet.has(item.href)).length

	return (
		<ProfileSheet>
			<ProfileSheetHeader
				icon={<Wrench className="h-4 w-4" />}
				title="工具箱"
				description="选择工具箱顶部展示哪些工具 tab；隐藏的工具仍可通过直链访问"
			/>
			<ul className="space-y-1" data-testid="tools-settings-list">
				{TOOLS_NAV_ITEMS.map((item) => {
					const shown = !hiddenSet.has(item.href)
					return (
						<li
							key={item.href}
							className="flex items-center justify-between gap-3 border-b border-border/40 py-1.5 last:border-0"
						>
							<div className="flex min-w-0 items-center gap-2 text-sm">
								<span className="text-muted-foreground">{item.icon}</span>
								<span className="font-medium">{item.label}</span>
							</div>
							<Switch
								checked={shown}
								disabled={!canEdit || (shown && visibleCount <= 1)}
								onCheckedChange={(checked) => setToolVisible(item.href, checked)}
								aria-label={`显示${item.label}`}
							/>
						</li>
					)
				})}
			</ul>
			<p className="text-xs text-muted-foreground">至少保留一个工具。</p>
		</ProfileSheet>
	)
}
