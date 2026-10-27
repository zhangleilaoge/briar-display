/**
 * Reverie 主题装饰与图标。
 * - 小图标：Phosphor Icons（MIT），统一 duotone 字重，颜色走 currentColor。
 * - 剪贴簿贴纸：Microsoft Fluent Emoji 3D（MIT）；怀表：Wikimedia Commons CC0；
 *   爱奥尼柱：Wikimedia Commons 公有领域线稿（已重新着色为 Arcane 藏青）。
 * - 邮戳为本仓库自绘的简单几何 SVG。
 * 来源与授权逐项记录在仓库根目录 ASSETS_LICENSES.md。
 */
import envelopeImg from '@/assets/decor/fluent-envelope.png'
import penImg from '@/assets/decor/fluent-fountain-pen.png'
import ribbonImg from '@/assets/decor/fluent-ribbon.png'
import sparklesImg from '@/assets/decor/fluent-sparkles.png'
import strawberryImg from '@/assets/decor/fluent-strawberry.png'
import columnImg from '@/assets/decor/ionic-column.svg'
import watchImg from '@/assets/decor/pocket-watch.svg'
import { cn } from '@/lib/utils'
import {
	BookOpenText,
	ChartLineUp,
	FolderOpen,
	HouseLine,
	Key,
	type IconProps as PhIconProps,
	Toolbox,
	UserCircle,
} from '@phosphor-icons/react'
import { type ImgHTMLAttributes, useId } from 'react'

export type OrnamentIconProps = Omit<PhIconProps, 'ref'>
type ImgProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'>

function srcOf(m: string | { src: string }): string {
	return typeof m === 'string' ? m : m.src
}

/* ---------------- 导航小图标（Phosphor duotone） ---------------- */

const duo = (Icon: typeof HouseLine) =>
	function OrnIcon(props: OrnamentIconProps) {
		return <Icon weight="duotone" aria-hidden {...props} />
	}

export const HomeIcon = duo(HouseLine)
export const ToolsIcon = duo(Toolbox)
export const FilesIcon = duo(FolderOpen)
export const JournalIcon = duo(BookOpenText)
export const MarketsIcon = duo(ChartLineUp)
export const KeyIcon = duo(Key)
export const ProfileIcon = duo(UserCircle)

/* ---------------- 剪贴簿贴纸（位图/矢量素材） ---------------- */

function Sticker({ src, className, alt = '', ...props }: ImgProps & { src: string }) {
	return (
		<img
			src={src}
			alt={alt}
			aria-hidden={alt ? undefined : true}
			draggable={false}
			decoding="async"
			loading="lazy"
			className={cn('pointer-events-none select-none object-contain', className)}
			{...props}
		/>
	)
}

/** 草莓贴纸：用户气泡 / 便签角饰 */
export function Strawberry({ className, ...props }: ImgProps) {
	return (
		<Sticker
			src={srcOf(strawberryImg)}
			className={cn('drop-shadow-[0_3px_4px_rgb(185_84_95/0.25)]', className)}
			{...props}
		/>
	)
}

/** 蝴蝶结贴纸 */
export function Ribbon({ className, ...props }: ImgProps) {
	return <Sticker src={srcOf(ribbonImg)} className={cn('drop-shadow-sm', className)} {...props} />
}

/** 信封贴纸 */
export function Envelope({ className, ...props }: ImgProps) {
	return <Sticker src={srcOf(envelopeImg)} className={cn('drop-shadow-sm', className)} {...props} />
}

/** 闪光贴纸 */
export function Sparkles({ className, ...props }: ImgProps) {
	return <Sticker src={srcOf(sparklesImg)} className={className} {...props} />
}

/** 怀表（复古线稿插画） */
export function PocketWatch({ className, ...props }: ImgProps) {
	return <Sticker src={srcOf(watchImg)} className={className} {...props} />
}

/** 钢笔贴纸 */
export function FountainPen({ className, ...props }: ImgProps) {
	return <Sticker src={srcOf(penImg)} className={cn('drop-shadow', className)} {...props} />
}

/** 邮戳（圆形 + 波浪线），用于明信片拼贴 */
export function Postmark({
	className,
	text = 'XIAOBUZI · PARIS · 1999',
	date = '27',
}: { className?: string; text?: string; date?: string }) {
	const arcId = `rv-postmark-${useId().replace(/:/g, '')}`
	return (
		<svg viewBox="0 0 120 120" className={className} aria-hidden>
			<defs>
				<path id={arcId} d="M60 60m-42 0a42 42 0 1 1 84 0a42 42 0 1 1-84 0" />
			</defs>
			<g fill="none" stroke="#3b4a72" strokeWidth="1.6" opacity=".8">
				<circle cx="60" cy="60" r="50" />
				<circle cx="60" cy="60" r="34" />
			</g>
			<text
				fontFamily="var(--font-label)"
				fontSize="9"
				letterSpacing="2.5"
				fill="#3b4a72"
				opacity=".85"
			>
				<textPath href={`#${arcId}`}>{text}</textPath>
			</text>
			<text
				x="60"
				y="68"
				textAnchor="middle"
				fontFamily="var(--font-display)"
				fontSize="24"
				fill="#3b4a72"
				opacity=".85"
			>
				{date}
			</text>
		</svg>
	)
}

/* ---------------- HUD 插画 ---------------- */

/** 希腊爱奥尼柱（公有领域建筑立面线稿，已着色为藏青） */
export function GreekColumn({ className, ...props }: ImgProps) {
	return <Sticker src={srcOf(columnImg)} className={className} {...props} />
}
