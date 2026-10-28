/**
 * Reverie 主题装饰与图标。
 * - 小图标：Phosphor Icons（MIT），统一 duotone，颜色走 currentColor。
 * - 背景/角饰：仅平面线稿 / 剪影 SVG（Wikimedia PD/CC0/CC BY），各素材全站至多出现一次；
 *   禁止 Fluent Emoji 3D / 茶壶 / 小天使。
 */
import antiqueKeyImg from '@/assets/decor/antique-key.svg'
import compassImg from '@/assets/decor/compass-rose.svg'
import doveOliveImg from '@/assets/decor/dove-olive.svg'
import fleurImg from '@/assets/decor/fleur-de-lis.svg'
import floral1913Img from '@/assets/decor/floral-1913.svg'
import floralLilienImg from '@/assets/decor/floral-lilien.svg'
import floralRoundImg from '@/assets/decor/floral-round.svg'
import floralSecessionImg from '@/assets/decor/floral-secession.svg'
import flowerPsfImg from '@/assets/decor/flower-psf.svg'
import gothicArchImg from '@/assets/decor/gothic-arch.svg'
import inkwellImg from '@/assets/decor/inkwell-pen.svg'
import columnImg from '@/assets/decor/ionic-column.svg'
import lanternImg from '@/assets/decor/lantern.svg'
import watchImg from '@/assets/decor/pocket-watch.svg'
import scissorsImg from '@/assets/decor/scissors-psf.svg'
import waxSealImg from '@/assets/decor/wax-seal.svg'
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

/* ---------------- 平面剪纸 / 线稿（各组件全站单点使用） ---------------- */

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

/** 怀表线稿 — 仅 stamp-input */
export function PocketWatch({ className, ...props }: ImgProps) {
	return <Sticker src={srcOf(watchImg)} className={className} {...props} />
}

/** 墨水瓶钢笔剪影 — 仅 stamp-input */
export function InkwellPen({ className, ...props }: ImgProps) {
	return <Sticker src={srcOf(inkwellImg)} className={className} {...props} />
}

/** 白鸽线稿 — 仅个人页 */
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

/** 1913 花饰 — 预留/备用 */
export function FloralStamp({ className, ...props }: ImgProps) {
	return <Sticker src={srcOf(floral1913Img)} className={cn('opacity-90', className)} {...props} />
}

/** 圆形花饰 — 仅注册页 BrandCollage */
export function FloralRound({ className, ...props }: ImgProps) {
	return <Sticker src={srcOf(floralRoundImg)} className={cn('opacity-90', className)} {...props} />
}

/** 分离派花饰 1899 — 仅博客 */
export function FloralSecession({ className, ...props }: ImgProps) {
	return (
		<Sticker src={srcOf(floralSecessionImg)} className={cn('opacity-90', className)} {...props} />
	)
}

/** 利林新艺术花饰 — 预留 */
export function FloralLilien({ className, ...props }: ImgProps) {
	return <Sticker src={srcOf(floralLilienImg)} className={cn('opacity-90', className)} {...props} />
}

/** PSF 合瓣花线稿 — 预留 */
export function FlowerPsf({ className, ...props }: ImgProps) {
	return <Sticker src={srcOf(flowerPsfImg)} className={className} {...props} />
}

/** 哥特尖拱 — 仅门户问候卡旁 */
export function GothicArch({ className, ...props }: ImgProps) {
	return <Sticker src={srcOf(gothicArchImg)} className={className} {...props} />
}

/** 爱奥尼柱 — 仅文件页 */
export function GreekColumn({ className, ...props }: ImgProps) {
	return <Sticker src={srcOf(columnImg)} className={className} {...props} />
}

/** PSF 剪刀线稿 — 仅工具箱 */
export function ScissorsCut({ className, ...props }: ImgProps) {
	return <Sticker src={srcOf(scissorsImg)} className={className} {...props} />
}

/** 扁平底纹鸢尾 — 仅登录 BrandCollage */
export function FleurDeLis({ className, ...props }: ImgProps) {
	return <Sticker src={srcOf(fleurImg)} className={className} {...props} />
}

/** 古董钥匙 — 仅管理后台 */
export function AntiqueKey({ className, ...props }: ImgProps) {
	return <Sticker src={srcOf(antiqueKeyImg)} className={className} {...props} />
}

/** 简易罗盘玫瑰 — 仅行情页 */
export function CompassRose({ className, ...props }: ImgProps) {
	return <Sticker src={srcOf(compassImg)} className={className} {...props} />
}

/** 蜡封印剪影 — 预留（登录用 Fleur） */
export function WaxSeal({ className, ...props }: ImgProps) {
	return <Sticker src={srcOf(waxSealImg)} className={className} {...props} />
}

/** 提灯剪影 — 预留 */
export function Lantern({ className, ...props }: ImgProps) {
	return <Sticker src={srcOf(lanternImg)} className={className} {...props} />
}

/** 邮戳（自绘）— 仅门户问候卡 */
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
