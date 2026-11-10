'use client'

import { ProfileSheet, ProfileSheetHeader } from '@/components/profile/ProfileSheet'
import { TOOLS_NAV_ITEMS } from '@/components/tools/ToolsLayout'
import { useToolsVisibility } from '@/components/tools/useToolsVisibility'
import { Button } from '@/components/ui/button'
import { RIBBON_ITEMS, type RibbonItem } from '@/components/ui/ribbon-items'
import { Switch } from '@/components/ui/switch'
import { useRibbonLock } from '@/components/ui/useRibbonLock'
import { useRibbonNavigation } from '@/components/ui/useRibbonNavigation'
import { usePermissions } from '@/contexts/PermissionContext'
import { ArrowDown, ArrowUp, Lock, PanelLeft, Wrench } from 'lucide-react'

/**
 * 个人中心「设置」：侧栏吊牌与工具箱 tab 的统一入口。
 * 侧栏复用 useRibbonNavigation / useRibbonLock（同一偏好键与本地缓存），这里改了侧栏实时生效。
 */
export default function SettingsPanel() {
	return (
		<div className="space-y-6">
			<RibbonSettingsCard />
			<ToolsSettingsCard />
		</div>
	)
}

function RibbonSettingsCard() {
	const { isAdmin } = usePermissions()
	const { order, canEdit, add, remove, move } = useRibbonNavigation()
	const { locked, canLock, toggleLocked } = useRibbonLock()
	const candidates = RIBBON_ITEMS.filter((item) => !item.adminOnly || isAdmin)
	const visible = order
		.map((kind) => candidates.find((item) => item.kind === kind))
		.filter((item): item is RibbonItem => Boolean(item))
	const hidden = candidates.filter((item) => !order.includes(item.kind))

	const moveBy = (index: number, delta: -1 | 1) => {
		const target = visible[index + delta]
		if (!target) return
		move(order.indexOf(visible[index].kind), order.indexOf(target.kind))
	}

	return (
		<ProfileSheet>
			<ProfileSheetHeader
				icon={<PanelLeft className="h-4 w-4" />}
				title="侧边菜单"
				description="调整左侧吊牌的顺序、显示哪些，以及是否固定展开；与侧栏上的编辑和锁同步"
			/>
			<div className="flex items-center justify-between gap-3 border-b border-border/40 py-2">
				<div className="flex items-center gap-2 text-sm">
					<Lock className="h-4 w-4 text-muted-foreground" />
					<span>固定展开</span>
					<span className="text-xs text-muted-foreground">开启后侧栏常驻，不随鼠标收起</span>
				</div>
				<Switch
					checked={locked}
					disabled={!canLock}
					onCheckedChange={(checked) => {
						if (checked !== locked) toggleLocked()
					}}
					aria-label="固定左侧导航"
				/>
			</div>
			<ul className="space-y-1" data-testid="ribbon-settings-list">
				{visible.map((item, index) => (
					<li
						key={item.kind}
						className="flex items-center justify-between gap-3 border-b border-border/40 py-1.5 last:border-0"
					>
						<RibbonLabel item={item} index={index + 1} />
						<div className="flex shrink-0 items-center gap-1">
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="h-8 w-8 rounded-none p-0"
								aria-label={`${item.label}上移`}
								disabled={!canEdit || index === 0}
								onClick={() => moveBy(index, -1)}
							>
								<ArrowUp className="h-3.5 w-3.5" />
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="h-8 w-8 rounded-none p-0"
								aria-label={`${item.label}下移`}
								disabled={!canEdit || index === visible.length - 1}
								onClick={() => moveBy(index, 1)}
							>
								<ArrowDown className="h-3.5 w-3.5" />
							</Button>
							<Switch
								className="ml-2"
								checked
								disabled={!canEdit || visible.length <= 1}
								onCheckedChange={() => remove(item.kind)}
								aria-label={`显示${item.label}`}
							/>
						</div>
					</li>
				))}
				{hidden.map((item) => (
					<li
						key={item.kind}
						className="flex items-center justify-between gap-3 border-b border-border/40 py-1.5 opacity-60 last:border-0"
					>
						<RibbonLabel item={item} />
						<Switch
							checked={false}
							disabled={!canEdit}
							onCheckedChange={() => add(item.kind)}
							aria-label={`显示${item.label}`}
						/>
					</li>
				))}
			</ul>
			<p className="text-xs text-muted-foreground">至少保留一个标签；重新显示的标签会排到最后。</p>
		</ProfileSheet>
	)
}

function RibbonLabel({ item, index }: { item: RibbonItem; index?: number }) {
	return (
		<div className="flex min-w-0 items-center gap-2 text-sm">
			<span className="w-5 shrink-0 text-right font-mono text-xs text-muted-foreground">
				{index ?? '—'}
			</span>
			<span className="font-medium">{item.label}</span>
			<span className="truncate font-label text-xs uppercase tracking-wide text-muted-foreground">
				{item.caption}
			</span>
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
