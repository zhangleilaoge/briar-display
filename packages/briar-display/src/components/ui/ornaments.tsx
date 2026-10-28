/**
 * Reverie 主题装饰与图标。
 * - 小图标：Phosphor Icons（MIT），统一 duotone 字重，颜色走 currentColor。
 * - 剪贴簿贴纸：Microsoft Fluent Emoji 3D（MIT）；怀表 / 小天使 / 鸽子 / 花饰 / 尖拱：
 *   Wikimedia Commons（CC0 / Public Domain / CC BY-SA 3.0，见 ASSETS_LICENSES.md）。
 * - 邮戳为本仓库自绘的简单几何 SVG。
 */
import cherubImg from '@/assets/decor/cherub-postscript.svg'
import doveOliveImg from '@/assets/decor/dove-olive.svg'
import floral1913Img from '@/assets/decor/floral-1913.svg'
import floralRoundImg from '@/assets/decor/floral-round.svg'
import classicalImg from '@/assets/decor/fluent-classical.png'
import doveImg from '@/assets/decor/fluent-dove.png'
import envelopeImg from '@/assets/decor/fluent-envelope.png'
import penImg from '@/assets/decor/fluent-fountain-pen.png'
import ladderImg from '@/assets/decor/fluent-ladder.png'
import ribbonImg from '@/assets/decor/fluent-ribbon.png'
import roseImg from '@/assets/decor/fluent-rose.png'
import sparklesImg from '@/assets/decor/fluent-sparkles.png'
import strawberryImg from '@/assets/decor/fluent-strawberry.png'
import teapotImg from '@/assets/decor/fluent-teapot.png'
import gothicArchImg from '@/assets/decor/gothic-arch.svg'
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

/* ---------------- 剪纸贴纸（白描边 + 柔影） ---------------- */

function Sticker({
	src,
	className,
	alt = '',
	cutout = true,
	...props
}: ImgProps & { src: string; cutout?: boolean }) {
	return (
		<img
			src={src}
			alt={alt}
			aria-hidden={alt ? undefined : true}
			draggable={false}
			decoding="async"
			loading="lazy"
			className={cn(
				'pointer-events-none select-none object-contain',
				cutout && 'rv-cutout',
				className,
			)}
			{...props}
		/>
	)
}

/** 草莓贴纸：用户气泡 / 便签角饰 */
export function Strawberry({ className, ...props }: ImgProps) {
	return <Sticker src={srcOf(strawberryImg)} className={className} {...props} />
}

/** 蝴蝶结贴纸 */
export function Ribbon({ className, ...props }: ImgProps) {
	return <Sticker src={srcOf(ribbonImg)} className={className} {...props} />
}

/** 信封贴纸 */
export function Envelope({ className, ...props }: ImgProps) {
	return <Sticker src={srcOf(envelopeImg)} className={className} {...props} />
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
	return <Sticker src={srcOf(penImg)} className={className} {...props} />
}

/** 小天使剪纸（公有领域雕版，弹窗角饰） */
export function Cherub({ className, ...props }: ImgProps) {
	return <Sticker src={srcOf(cherubImg)} className={className} {...props} />
}

/** 白鸽（Fluent 3D） */
export function Dove({ className, ...props }: ImgProps) {
	return <Sticker src={srcOf(doveImg)} className={className} {...props} />
}

/** 白鸽线稿（CC0） */
export function DoveOlive({ className, ...props }: ImgProps) {
	return (
		<Sticker
			src={srcOf(doveOliveImg)}
			className={cn('rv-cutout-soft', className)}
			cutout={false}
			{...props}
		/>
	)
}

/** 茶壶贴纸 */
export function Teapot({ className, ...props }: ImgProps) {
	return <Sticker src={srcOf(teapotImg)} className={className} {...props} />
}

/** 玫瑰贴纸 */
export function Rose({ className, ...props }: ImgProps) {
	return <Sticker src={srcOf(roseImg)} className={className} {...props} />
}

/** 古典建筑贴纸 */
export function ClassicalBuilding({ className, ...props }: ImgProps) {
	return <Sticker src={srcOf(classicalImg)} className={className} {...props} />
}

/** 梯子贴纸 */
export function Ladder({ className, ...props }: ImgProps) {
	return <Sticker src={srcOf(ladderImg)} className={className} {...props} />
}

/** 1913 花饰线稿（公有领域） */
export function FloralStamp({ className, ...props }: ImgProps) {
	return <Sticker src={srcOf(floral1913Img)} className={cn('opacity-90', className)} {...props} />
}

/** 圆形花饰（公有领域） */
export function FloralRound({ className, ...props }: ImgProps) {
	return <Sticker src={srcOf(floralRoundImg)} className={cn('opacity-90', className)} {...props} />
}

/** 哥特尖拱（CC BY-SA 3.0） */
export function GothicArch({ className, ...props }: ImgProps) {
	return <Sticker src={srcOf(gothicArchImg)} className={className} {...props} />
}

/** 邮戳（圆形 + 波浪线），用于明信片拼贴 */
export function Postmark({
	className,
	text = 'XIAOBUZI · PARIS · 1999',
	date = '27',
}: { className?: string; text?: string; date?: string }) {
	const arcId = `rv-postmark-${useId().replace(/:/g, '')}`
	return (
		<svg viewBox="0 0 120 120" className={cn('rv-cutout-soft', className)} aria-hidden>
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
