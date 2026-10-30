import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { useState } from 'react'
import { toast } from 'sonner'
import { StyleExhibit, StyleSection } from './StyleSection'

export function OverlayExhibits() {
	const [enabled, setEnabled] = useState(false)

	return (
		<StyleSection
			id="overlays"
			index="03"
			title="浮层与反馈"
			caption="Surfaces"
			description="弹窗、点击浮层、悬停卡片和 Toast 都由真实状态驱动；浮层会继承当前选中的展览主题。"
		>
			<StyleExhibit title="Dialog 弹窗" source="ui/dialog.tsx">
				<div className="flex flex-wrap gap-3">
					<Dialog>
						<DialogTrigger asChild>
							<Button>打开纸片弹窗</Button>
						</DialogTrigger>
						<DialogContent>
							<DialogHeader kicker="Carnet · Composants">
								<DialogTitle>组件陈列说明</DialogTitle>
								<DialogDescription>
									这是业务页面使用的同一个 Dialog，包含焦点管理、遮罩和关闭动效。
								</DialogDescription>
							</DialogHeader>
							<div className="rounded-control border border-dashed border-border p-4 text-sm leading-relaxed">
								弹窗内容只负责展示，不请求接口。可以按 Esc 或点击遮罩关闭。
							</div>
							<DialogFooter>
								<DialogClose asChild>
									<Button variant="default">返回展览</Button>
								</DialogClose>
								<DialogClose asChild>
									<Button>完成</Button>
								</DialogClose>
							</DialogFooter>
						</DialogContent>
					</Dialog>

					<Dialog>
						<DialogTrigger asChild>
							<Button variant="default">打开终端变体</Button>
						</DialogTrigger>
						<DialogContent variant="terminal">
							<DialogHeader>
								<DialogTitle>terminal — preview</DialogTitle>
								<DialogDescription>同一组件的深色终端变体。</DialogDescription>
							</DialogHeader>
							<pre className="overflow-x-auto text-xs leading-relaxed">
								$ ui inspect dialog\n✓ keyboard focus\n✓ escape to close
							</pre>
						</DialogContent>
					</Dialog>
				</div>
			</StyleExhibit>

			<div className="grid gap-4 lg:grid-cols-2">
				<StyleExhibit title="Popover 点击浮层" source="ui/popover.tsx">
					<Popover>
						<PopoverTrigger asChild>
							<Button variant="default">点击调整展品</Button>
						</PopoverTrigger>
						<PopoverContent className="w-80">
							<div className="space-y-3">
								<div>
									<h3 className="font-heading text-lg font-semibold">展品设置</h3>
									<p className="text-sm text-muted-foreground">点击外部或按 Esc 收起。</p>
								</div>
								<div className="flex items-center justify-between gap-4">
									<Label htmlFor="style-popover-switch">显示辅助线</Label>
									<Switch
										id="style-popover-switch"
										checked={enabled}
										onCheckedChange={setEnabled}
									/>
								</div>
							</div>
						</PopoverContent>
					</Popover>
				</StyleExhibit>

				<StyleExhibit title="HoverCard 悬停浮层" source="ui/hover-card.tsx">
					<HoverCard openDelay={120} closeDelay={0}>
						<HoverCardTrigger asChild>
							<Button variant="default">悬停查看组件信息</Button>
						</HoverCardTrigger>
						<HoverCardContent className="w-80" align="start">
							<p className="font-label text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
								HoverCard · 120ms
							</p>
							<h3 className="mt-1 font-heading text-lg font-semibold">
								快速出现，无需等待原生提示
							</h3>
							<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
								侧边栏导航也使用这套交互，浮层可以移动到内容上方，并跟随当前主题。
							</p>
						</HoverCardContent>
					</HoverCard>
				</StyleExhibit>
			</div>

			<StyleExhibit title="Sonner 消息反馈" source="ui/sonner.tsx">
				<div className="flex flex-wrap gap-3">
					<Button variant="default" onClick={() => toast.success('展品已加入清单')}>
						成功提示
					</Button>
					<Button variant="default" onClick={() => toast.error('这是一件错误提示展品')}>
						错误提示
					</Button>
					<Button
						variant="default"
						onClick={() =>
							toast('已收藏这件组件', {
								description: '仅展示 Toast 交互，不会写入任何数据。',
								action: { label: '撤销', onClick: () => toast.success('已撤销') },
							})
						}
					>
						带操作提示
					</Button>
				</div>
			</StyleExhibit>
		</StyleSection>
	)
}
