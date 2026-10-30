import { Astrolabe } from '@/components/ui/astrolabe'
import {
	AntiqueKey,
	CompassRose,
	DoveOlive,
	FilesIcon,
	FleurDeLis,
	FloralLilien,
	FloralRound,
	FloralSecession,
	FloralStamp,
	FlowerPsf,
	GothicArch,
	GreekColumn,
	HomeIcon,
	InkwellPen,
	JournalIcon,
	KeyIcon,
	Lantern,
	MarketsIcon,
	PocketWatch,
	Postmark,
	ProfileIcon,
	ScissorsCut,
	StyleIcon,
	ToolsIcon,
	WaxSeal,
} from '@/components/ui/ornaments'
import { PaperSheet, type PaperSheetVariant } from '@/components/ui/paper-sheet'
import { RIBBON_ITEMS } from '@/components/ui/ribbon-sidebar'
import { RibbonTag } from '@/components/ui/ribbon-tags'
import { BrandCollage, HudTitle, ScrapTitle } from '@/components/ui/theme-shell'
import type { ComponentType } from 'react'
import { StyleExhibit, StyleSection } from './StyleSection'

const PAPER_VARIANTS: PaperSheetVariant[] = [
	'binder',
	'torn',
	'stamp',
	'sticky',
	'polaroid',
	'kraft',
	'ticket',
	'index',
]

const DECOR: [string, ComponentType<{ className?: string }>][] = [
	['PocketWatch', PocketWatch],
	['InkwellPen', InkwellPen],
	['DoveOlive', DoveOlive],
	['FloralStamp', FloralStamp],
	['FloralRound', FloralRound],
	['FloralSecession', FloralSecession],
	['FloralLilien', FloralLilien],
	['FlowerPsf', FlowerPsf],
	['GothicArch', GothicArch],
	['GreekColumn', GreekColumn],
	['ScissorsCut', ScissorsCut],
	['FleurDeLis', FleurDeLis],
	['AntiqueKey', AntiqueKey],
	['CompassRose', CompassRose],
	['WaxSeal', WaxSeal],
	['Lantern', Lantern],
	['Postmark', Postmark],
]

const ICONS = [
	HomeIcon,
	ToolsIcon,
	FilesIcon,
	JournalIcon,
	MarketsIcon,
	KeyIcon,
	ProfileIcon,
	StyleIcon,
]

export function ThemeExhibits() {
	return (
		<StyleSection
			id="theme"
			index="05"
			title="主题与纸艺"
			caption="Papeterie"
			description="纸张、吊牌、装饰和标题都是可独立组合的组件；当前页本身也是 ThemeShell 与 PageHeader 的实景展品。"
		>
			<StyleExhibit title="PaperSheet 纸质容器" source="ui/paper-sheet.tsx">
				<div className="grid gap-5 p-2 sm:grid-cols-2 xl:grid-cols-4">
					{PAPER_VARIANTS.map((variant) => (
						<PaperSheet key={variant} variant={variant} className="min-h-36">
							<h3 className="font-heading text-lg font-semibold">{variant}</h3>
							<p className="mt-2 text-sm leading-relaxed text-muted-foreground">
								同一种内容，由容器变体提供不同的纸张结构。
							</p>
						</PaperSheet>
					))}
				</div>
			</StyleExhibit>

			<div className="grid gap-4 lg:grid-cols-2">
				<StyleExhibit title="主题标题组件" source="ui/theme-shell.tsx">
					<div className="space-y-8 p-3">
						<HudTitle index="06" label="Collection" title="奥术 HUD 标题" script="Archive" />
						<ScrapTitle script="Bonjour" title="手账纸艺标题" />
					</div>
				</StyleExhibit>
				<StyleExhibit title="Astrolabe 星盘" source="ui/astrolabe.tsx">
					<Astrolabe className="mx-auto h-64 w-64" />
				</StyleExhibit>
			</div>

			<StyleExhibit title="Ribbon Tags 吊牌系统" source="ui/ribbon-tags.tsx">
				<div className="grid grid-cols-2 gap-4 sm:grid-cols-4 xl:grid-cols-8">
					{RIBBON_ITEMS.map(({ kind, caption }) => (
						<div key={kind} className="flex flex-col items-center gap-2">
							<div className="rv-ribbon-tag" data-kind={kind}>
								<RibbonTag
									kind={kind}
									caption={caption}
									active={kind === 'style'}
									stickerLoading="lazy"
								/>
							</div>
							<code className="text-[10px] text-muted-foreground">{kind}</code>
						</div>
					))}
				</div>
			</StyleExhibit>

			<StyleExhibit title="Ornaments 装饰与图标" source="ui/ornaments.tsx">
				<div className="space-y-6">
					<div className="flex flex-wrap items-center gap-5 border-b border-border/60 pb-5">
						{ICONS.map((Icon, index) => (
							<Icon key={index} className="h-8 w-8 text-[color:var(--rv-navy)]" />
						))}
						<span className="text-xs text-muted-foreground">Phosphor duotone 图标</span>
					</div>
					<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
						{DECOR.map(([name, Decor]) => (
							<div
								key={name}
								className="flex min-h-32 flex-col items-center justify-between gap-3 rounded-control border border-border/60 bg-card/40 p-3"
							>
								<Decor className="h-20 w-20 text-[color:var(--rv-navy)]" />
								<code className="text-[10px] text-muted-foreground">{name}</code>
							</div>
						))}
					</div>
				</div>
			</StyleExhibit>

			<StyleExhibit title="BrandCollage 品牌拼贴" source="ui/theme-shell.tsx">
				<BrandCollage script="Bienvenue" subtitle="Le cabinet des composants" motif="floral" />
			</StyleExhibit>
		</StyleSection>
	)
}
