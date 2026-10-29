import { Card, CardContent } from '@/components/ui/card'
import { ScrapTitle, ThemeShell } from '@/components/ui/theme-shell'

export default function BuilderIOPage() {
	return (
		<ThemeShell variant="scrapbook">
			<main className="rv-content-inset mx-auto w-full max-w-3xl px-6 py-12">
				<ScrapTitle script="Brouillon" title="hello builder-io page" />
				<Card className="mt-6">
					<CardContent className="p-6 text-sm text-muted-foreground">
						Builder.io 可视化页面占位，内容接入后会渲染在这里。
					</CardContent>
				</Card>
			</main>
		</ThemeShell>
	)
}
