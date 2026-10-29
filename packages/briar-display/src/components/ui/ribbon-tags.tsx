/**
 * 左侧吊牌：每项独立手绘异形壳 + 插画切图贴纸（Wikimedia PD/CC0/CC BY-SA，见 assets/decor/ribbon-stickers/SOURCES.md）。
 * 禁止共用同一矩形外壳只换图标；法文 caption 由 ribbon-sidebar 可见渲染。
 */
import accueilHouse from '@/assets/decor/ribbon-stickers/accueil-house.png'
import clefKey from '@/assets/decor/ribbon-stickers/clef-key.png'
import etoilesEstoile from '@/assets/decor/ribbon-stickers/etoiles-estoile.png'
import fichiersPurse from '@/assets/decor/ribbon-stickers/fichiers-purse.png'
import moiCameo from '@/assets/decor/ribbon-stickers/moi-cameo.png'
import outilsInkwell from '@/assets/decor/ribbon-stickers/outils-inkwell-quill.png'
import penseesBook from '@/assets/decor/ribbon-stickers/pensees-book.png'
import { cn } from '@/lib/utils'
import type { ReactNode, SVGProps } from 'react'

export type RibbonTagKind =
	| 'home'
	| 'tools'
	| 'files'
	| 'thoughts'
	| 'markets'
	| 'admin'
	| 'profile'

type TagSvgProps = SVGProps<SVGSVGElement> & { active?: boolean }

const ink = 'var(--sidebar-tag-stroke)'
const soft = 'var(--sidebar-icon)'
const fill = 'var(--sidebar-tag-fill)'
const activeFill = 'var(--sidebar-active-fill)'

/** 白描边 ×1.5 + 手绘微不对称 path（对照 mockup HAND_PATHS / STROKE.hand） */
const STROKE_WHITE = 8.25
const STROKE_INK = 1.725

/** 手绘异形壳 path：边缘微抖，左右不完全对称 */
export const RIBBON_HAND_PATHS: Record<RibbonTagKind, string> = {
	home:
		'M9.6 19.2' +
		'C9.4 12.2 13.8 5.4 21.2 3.6' +
		'C26.4 2.3 32.8 2.8 37.6 5.8' +
		'C42.8 9.1 46.2 14.6 46.0 20.4' +
		'L45.2 56.8' +
		'C45.0 60.6 42.0 63.8 38.4 64.2' +
		'L16.8 63.4' +
		'C13.2 63.0 10.4 60.2 10.2 56.6' +
		'Z',
	tools:
		'M29.4 11.2' +
		'C36.8 11.8 43.6 17.4 47.8 26.2' +
		'C50.6 33.0 52.2 41.4 51.4 47.6' +
		'C51.0 51.2 48.2 53.6 44.6 53.8' +
		'L12.2 52.6' +
		'C8.4 52.2 6.2 49.4 6.6 45.8' +
		'C8.4 32.2 15.2 19.6 24.8 13.4' +
		'C26.2 12.4 27.8 11.6 29.4 11.2Z',
	files:
		'M15.4 13.6' +
		'L38.8 14.4' +
		'L45.6 23.2' +
		'L45.0 56.4' +
		'C44.8 59.8 42.2 62.4 38.8 62.6' +
		'L13.6 61.4' +
		'C10.4 61.0 9.0 58.2 9.2 55.2' +
		'L10.4 22.8' +
		'C10.6 19.6 12.6 15.8 15.4 13.6Z',
	thoughts:
		'M27.2 12.4' +
		'L35.8 17.6' +
		'L46.6 20.2' +
		'L48.8 30.6' +
		'L53.4 41.8' +
		'L45.6 50.4' +
		'L40.8 60.8' +
		'L28.6 59.6' +
		'L16.4 61.2' +
		'L10.2 51.6' +
		'L2.8 42.2' +
		'L6.4 31.8' +
		'L7.8 21.4' +
		'L18.6 17.8' +
		'Z',
	markets:
		'M10.4 16.4' +
		'C10.2 10.2 15.6 4.2 23.2 3.4' +
		'C30.8 2.6 38.4 5.8 42.6 11.6' +
		'C44.8 14.6 45.6 18.2 45.4 21.2' +
		'L44.8 50.6' +
		'C42.2 54.2 38.6 52.8 35.4 55.4' +
		'C32.2 58.0 30.4 61.6 27.2 61.8' +
		'C23.8 62.0 21.6 58.2 18.2 55.8' +
		'C14.8 53.4 12.2 55.6 10.6 52.4' +
		'Z',
	admin:
		'M26.8 63.6' +
		'C14.2 51.4 5.2 42.2 5.4 29.4' +
		'C5.6 20.2 12.4 11.6 21.2 11.8' +
		'C24.6 11.9 26.8 13.6 27.4 16.2' +
		'C28.2 13.4 31.2 11.2 35.6 11.4' +
		'C44.2 11.8 51.6 18.8 51.2 29.6' +
		'C50.6 40.8 42.8 51.2 26.8 63.6Z',
	profile:
		'M27.2 7.6' +
		'C38.6 7.2 48.4 16.4 49.2 32.8' +
		'C50.0 49.2 41.6 64.6 28.4 65.2' +
		'C15.2 65.8 7.4 52.6 7.6 35.4' +
		'C7.8 18.2 15.8 8.0 27.2 7.6Z',
}

export const RIBBON_HANG_CY: Record<RibbonTagKind, number> = {
	home: 10,
	tools: 11,
	files: 12,
	thoughts: 14,
	markets: 10,
	admin: 10,
	profile: 8,
}

function srcOf(m: string | { src: string }): string {
	return typeof m === 'string' ? m : m.src
}

/** 插画切图贴纸（已着色 + 白撕纸边）；避开 portal 轮播同款素材 */
export const RIBBON_STICKER_SRC: Record<RibbonTagKind, string> = {
	home: srcOf(accueilHouse),
	tools: srcOf(outilsInkwell),
	files: srcOf(fichiersPurse),
	thoughts: srcOf(penseesBook),
	markets: srcOf(etoilesEstoile),
	admin: srcOf(clefKey),
	profile: srcOf(moiCameo),
}

/** 白描边贴纸外壳：外白边 + 内线（无内嵌图案，图案由 sidebar 叠图） */
function StickerShell({
	d,
	active,
	vb = '0 0 56 72',
	children,
	className,
	...rest
}: TagSvgProps & { d: string; vb?: string; children?: ReactNode }) {
	return (
		<svg
			viewBox={vb}
			className={cn('rv-ribbon-sticker h-full w-full overflow-visible', className)}
			aria-hidden
			{...rest}
		>
			<path
				d={d}
				fill={active ? activeFill : fill}
				stroke="#fff"
				strokeWidth={STROKE_WHITE}
				strokeLinejoin="round"
				strokeLinecap="round"
				paintOrder="stroke fill"
				className="rv-tag-shape"
			/>
			<path
				d={d}
				fill="none"
				stroke={ink}
				strokeWidth={STROKE_INK}
				strokeLinejoin="round"
				strokeLinecap="round"
				className="rv-tag-outline"
			/>
			{children}
		</svg>
	)
}

/** 小挂环 + 绳结（略加粗，配合 ×1.5 壳） */
function HangBow({ cx = 28, cy = 10 }: { cx?: number; cy?: number }) {
	return (
		<g fill="none" stroke={ink} strokeWidth={1.4} strokeLinecap="round">
			<path d={`M${cx} 0 v${cy - 4}`} stroke="var(--sidebar-string)" strokeWidth={1.35} />
			<circle cx={cx} cy={cy} r={2.5} fill={fill} />
			<path
				d={`M${cx - 6.2} ${cy - 0.8}c1.6-3.2 4.1-3.1 6.1-0.9 1.9-2.2 4.7-2.3 6.2 0.8-1.9 1.3-4.0.9-6.2-.1-2.3 1.1-4.4 1.5-6.1.2z`}
				fill={soft}
				fillOpacity={0.35}
				stroke={ink}
			/>
			<path d={`M${cx} ${cy - 2}v4`} />
		</g>
	)
}

function TagShell({
	kind,
	active,
	className,
	...rest
}: TagSvgProps & { kind: RibbonTagKind }) {
	return (
		<StickerShell d={RIBBON_HAND_PATHS[kind]} active={active} className={className} {...rest}>
			<HangBow cy={RIBBON_HANG_CY[kind]} />
		</StickerShell>
	)
}

export function TagHome(p: TagSvgProps) {
	return <TagShell kind="home" {...p} />
}
export function TagTools(p: TagSvgProps) {
	return <TagShell kind="tools" {...p} />
}
export function TagFiles(p: TagSvgProps) {
	return <TagShell kind="files" {...p} />
}
export function TagThoughts(p: TagSvgProps) {
	return <TagShell kind="thoughts" {...p} />
}
export function TagMarkets(p: TagSvgProps) {
	return <TagShell kind="markets" {...p} />
}
export function TagAdmin(p: TagSvgProps) {
	return <TagShell kind="admin" {...p} />
}
export function TagProfile(p: TagSvgProps) {
	return <TagShell kind="profile" {...p} />
}

export const RIBBON_TAG_BY_KIND: Record<RibbonTagKind, (p: TagSvgProps) => ReactNode> = {
	home: TagHome,
	tools: TagTools,
	files: TagFiles,
	thoughts: TagThoughts,
	markets: TagMarkets,
	admin: TagAdmin,
	profile: TagProfile,
}

/** 轻微错落：旋转 + 水平微偏 */
export const RIBBON_JITTER: { rotate: number; x: number }[] = [
	{ rotate: -5, x: -2 },
	{ rotate: 4, x: 3 },
	{ rotate: -3, x: 1 },
	{ rotate: 6, x: -3 },
	{ rotate: -4, x: 2 },
	{ rotate: 3, x: -1 },
	{ rotate: -6, x: 2 },
]
