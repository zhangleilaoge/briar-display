import { Badge } from '@/components/ui/badge'
import {
	Breadcrumb,
	BreadcrumbEllipsis,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus } from 'lucide-react'
import { StyleExhibit, StyleSection } from './StyleSection'

const BUTTON_VARIANTS = ['default', 'primary', 'ghost', 'link', 'destructive'] as const
const BADGE_VARIANTS = [
	'default',
	'secondary',
	'outline',
	'success',
	'warning',
	'info',
	'danger',
	'plum',
	'muted',
	'destructive',
] as const

export function BasicExhibits() {
	return (
		<StyleSection
			id="basics"
			index="01"
			title="基础与导航"
			caption="Essentiels"
			description="按钮、标识、卡片、面包屑和选项卡共享主题 token；这里展示的是全站正在使用的同一份实现。"
		>
			<StyleExhibit title="Button 按钮" source="ui/button.tsx">
				<div className="space-y-5">
					<div className="flex flex-wrap items-center gap-3">
						{BUTTON_VARIANTS.map((variant) => (
							<Button key={variant} variant={variant}>
								{variant}
							</Button>
						))}
					</div>
					<div className="flex flex-wrap items-center gap-3 border-t border-border/60 pt-4">
						<Button size="sm">小按钮</Button>
						<Button>默认尺寸</Button>
						<Button size="lg">大按钮</Button>
						<Button size="icon" aria-label="新增">
							<Plus className="h-4 w-4" />
						</Button>
						<Button disabled>禁用状态</Button>
					</div>
				</div>
			</StyleExhibit>

			<StyleExhibit title="Badge 标识" source="ui/badge.tsx">
				<div className="flex flex-wrap gap-2">
					{BADGE_VARIANTS.map((variant) => (
						<Badge key={variant} variant={variant}>
							{variant}
						</Badge>
					))}
				</div>
			</StyleExhibit>

			<div className="grid gap-4 lg:grid-cols-2">
				<StyleExhibit title="Card 卡片" source="ui/card.tsx">
					<Card>
						<CardHeader>
							<CardTitle>纸片档案</CardTitle>
							<CardDescription>Header、Content 与 Footer 的自由组合。</CardDescription>
						</CardHeader>
						<CardContent className="text-sm leading-relaxed">
							卡片只负责内容容器，不携带业务数据，也不预设页面场景。
						</CardContent>
						<CardFooter className="justify-end gap-2">
							<Button variant="ghost" size="sm">
								稍后
							</Button>
							<Button size="sm">确认</Button>
						</CardFooter>
					</Card>
				</StyleExhibit>

				<StyleExhibit title="Tabs 选项卡" source="ui/tabs.tsx">
					<Tabs defaultValue="design">
						<TabsList aria-label="展品分类">
							<TabsTrigger value="design">设计</TabsTrigger>
							<TabsTrigger value="interaction">交互</TabsTrigger>
							<TabsTrigger value="tokens">令牌</TabsTrigger>
						</TabsList>
						<TabsContent value="design" className="p-3 text-sm leading-relaxed">
							视觉变体由主题类切换，不在业务页重复写颜色。
						</TabsContent>
						<TabsContent value="interaction" className="p-3 text-sm leading-relaxed">
							支持方向键切换、Enter 确认，选中滑块随内容移动。
						</TabsContent>
						<TabsContent value="tokens" className="p-3 text-sm leading-relaxed">
							颜色、圆角、字体和动效都来自统一的 CSS 变量。
						</TabsContent>
					</Tabs>
				</StyleExhibit>
			</div>

			<StyleExhibit title="Breadcrumb 面包屑" source="ui/breadcrumb.tsx">
				<Breadcrumb>
					<BreadcrumbList>
						<BreadcrumbItem>
							<BreadcrumbLink href="/briar/">xiaobuzi</BreadcrumbLink>
						</BreadcrumbItem>
						<BreadcrumbSeparator />
						<BreadcrumbItem>
							<BreadcrumbEllipsis />
						</BreadcrumbItem>
						<BreadcrumbSeparator />
						<BreadcrumbItem>
							<BreadcrumbLink href="/briar/style">风格</BreadcrumbLink>
						</BreadcrumbItem>
						<BreadcrumbSeparator />
						<BreadcrumbItem>
							<BreadcrumbPage>基础与导航</BreadcrumbPage>
						</BreadcrumbItem>
					</BreadcrumbList>
				</Breadcrumb>
			</StyleExhibit>
		</StyleSection>
	)
}
