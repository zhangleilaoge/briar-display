/**
 * Reverie 主题装饰与图标。
 * - 小图标：Phosphor Icons（MIT），统一 duotone，颜色走 currentColor。
 * - 背景/角饰：仅平面线稿 / 剪影 SVG（Wikimedia PD/CC0/CC BY），各素材全站至多出现一次；
 *   禁止 Fluent Emoji 3D / 茶壶 / 小天使。
 */
import { dailyIndex, shanghaiDateKey } from '@/data/daily-greetings'
import { assetUrl } from '@/lib/assets'
import { cn } from '@/lib/utils'
import {
	BookOpenText,
	ChartLineUp,
	FolderOpen,
	HouseLine,
	Key,
	Palette,
	type IconProps as PhIconProps,
	Toolbox,
	UserCircle,
} from '@phosphor-icons/react'
import type { ImgHTMLAttributes } from 'react'
import { SCRAPBOOK_STICKERS } from './scrapbook-stickers'

export type OrnamentIconProps = Omit<PhIconProps, 'ref'>
type ImgProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'>

const floral1913Img = assetUrl('decor/floral-1913.svg')
const gothicArchImg = assetUrl('decor/gothic-arch.svg')
const columnImg = assetUrl('decor/ionic-column.svg')
const flowerPsfImg = assetUrl('decor/stationery-stickers/01-00-iris.png')
const waxSealImg = assetUrl('decor/stationery-stickers/01-02-wax-seal.png')
const floralSecessionImg = assetUrl('decor/stationery-stickers/01-05-postcard.png')
const doveOliveImg = assetUrl('decor/stationery-stickers/01-06-paper-plane.png')
const scissorsImg = assetUrl('decor/stationery-stickers/01-08-binder-clip.png')
const floralRoundImg = assetUrl('decor/stationery-stickers/01-11-lace-doily.png')
const inkwellImg = assetUrl('decor/stationery-stickers/01-13-inkwell.png')
const antiqueKeyImg = assetUrl('decor/stationery-stickers/01-14-brass-key.png')
const watchImg = assetUrl('decor/stationery-stickers/01-15-pocket-watch.png')
const floralLilienImg = assetUrl('decor/stationery-stickers/01-16-lavender.png')
const fleurImg = assetUrl('decor/stationery-stickers/01-18-bow.png')
const compassImg = assetUrl('decor/stationery-stickers/02-07-blue-pocket-watch.png')
const lanternImg = assetUrl('decor/stationery-stickers/02-16-candelabrum.png')

function srcOf(src: string): string {
	return src
}

/* ---------------- 导航小图标（Phosphor duotone） ---------------- */

const duo = (Icon: typeof HouseLine) =>
	function OrnIcon(props: OrnamentIconProps) {
		return <Icon weight="duotone" aria-hidden {...props} />
	}

export const HomeIcon = duo(HouseLine)
export const StyleIcon = duo(Palette)
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

/** 1913 花饰 — 仅门户首页背景 */
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

/** 哥特尖拱 — 仅门户首页背景 */
export function GothicArch({ className, ...props }: ImgProps) {
	return <Sticker src={srcOf(gothicArchImg)} className={className} {...props} />
}

/** 爱奥尼柱 — 仅门户首页背景 */
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

/** 提灯剪影 — 仅门户首页背景 */
export function Lantern({ className, ...props }: ImgProps) {
	return <Sticker src={srcOf(lanternImg)} className={className} {...props} />
}

/** 问候卡角贴：按上海时区日历日固定随机，同日刷新不变。 */
export function Postmark({
	className,
	text: _text,
	date: _date,
	...props
}: ImgProps & { text?: string; date?: string }) {
	const index = dailyIndex(`${shanghaiDateKey()}-postmark`, SCRAPBOOK_STICKERS.length)
	return (
		<Sticker
			src={SCRAPBOOK_STICKERS[index]}
			className={cn('rv-cutout-soft', className)}
			cutout={false}
			{...props}
		/>
	)
}
