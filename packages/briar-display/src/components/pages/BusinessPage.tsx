import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function BusinessPage() {
	return (
		<div className="min-h-screen bg-[radial-gradient(circle_at_top,_hsl(var(--muted))_0%,_hsl(var(--background))_55%)]">
			<div className="container flex min-h-screen items-center justify-center">
				<Card className="max-w-2xl">
					<CardHeader>
						<CardTitle>业务工作台</CardTitle>
						<CardDescription>这里将展示你的业务模块与关键指标。</CardDescription>
					</CardHeader>
					<CardContent className="space-y-6">
						<div className="rounded-xl border border-dashed border-border/70 bg-muted/30 p-10 text-center">
							<p className="text-lg font-medium">业务页面暂未配置</p>
							<p className="mt-2 text-sm text-muted-foreground">
								你可以先创建第一个模块，随后我们再接入权限与数据。
							</p>
						</div>
						<div className="flex flex-wrap gap-3">
							<Button>创建业务模块</Button>
							<Button variant="outline">查看操作指南</Button>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	)
}
