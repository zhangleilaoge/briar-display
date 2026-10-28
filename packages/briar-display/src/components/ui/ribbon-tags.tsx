/**
 * 左侧吊牌：每项独立外形 + 蓝白线稿贴纸（对照目标案例）。
 * 禁止共用同一矩形外壳只换图标。
 */
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

/** 白描边贴纸外壳：外白边 + 内线 */
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
			{/* 白 sticker 外描边（模拟模切白边） */}
			<path
				d={d}
				fill={active ? activeFill : fill}
				stroke="#fff"
				strokeWidth={5.5}
				strokeLinejoin="round"
				paintOrder="stroke fill"
				className="rv-tag-shape"
			/>
			{/* 蓝灰细线 */}
			<path
				d={d}
				fill="none"
				stroke={ink}
				strokeWidth={1.15}
				strokeLinejoin="round"
				className="rv-tag-outline"
			/>
			{children}
		</svg>
	)
}

/** 小挂环 + 绳结（各牌顶部统一挂感，外形仍各自不同） */
function HangBow({ cx = 28, cy = 10 }: { cx?: number; cy?: number }) {
	return (
		<g fill="none" stroke={ink} strokeWidth={1.1} strokeLinecap="round">
			<path d={`M${cx} 0 v${cy - 4}`} stroke="var(--sidebar-string)" strokeWidth={1} />
			<circle cx={cx} cy={cy} r={2.2} fill={fill} />
			{/* 小蝴蝶结 */}
			<path
				d={`M${cx - 6} ${cy - 1}c1.5-3 4-3 6-1 2-2 4.5-2 6 1-1.8 1.2-3.8.8-6-.2-2.2 1-4.2 1.4-6 .2z`}
				fill={soft}
				fillOpacity={0.35}
				stroke={ink}
			/>
			<path d={`M${cx} ${cy - 2}v4`} />
		</g>
	)
}

/** 首页 · Accueil — 拱形牌 + 大蝴蝶结 */
export function TagHome({ active, className, ...rest }: TagSvgProps) {
	// 拱顶 + 圆角底
	const d = 'M10 18c0-8 8-14 18-14s18 6 18 14v40c0 3-2.5 5.5-5.5 5.5H15.5C12.5 63.5 10 61 10 58Z'
	return (
		<StickerShell d={d} active={active} className={className} {...rest}>
			<HangBow />
			{/* 大蝴蝶结线稿 */}
			<g
				fill="none"
				stroke={ink}
				strokeWidth={1.2}
				strokeLinecap="round"
				strokeLinejoin="round"
				transform="translate(0,6)"
			>
				<path
					d="M28 30c-5-8-14-7-14 1 0 5 5 8 14 11 9-3 14-6 14-11 0-8-9-9-14-1z"
					fill={soft}
					fillOpacity={0.22}
				/>
				<path d="M28 28v16" />
				<path d="M22 36h12" />
				<path d="M18 42c3 3 7 4 10 4s7-1 10-4" />
				{/* 飘带 */}
				<path d="M22 44l-4 10M34 44l4 10" />
			</g>
		</StickerShell>
	)
}

/** 工具 · Outils — 扇形牌 + 墨水瓶（与行情波浪底区分） */
export function TagTools({ active, className, ...rest }: TagSvgProps) {
	/* 扇面：顶宽底收，两侧弧撑开 */
	const d = 'M28 12c14 2 22 14 24 34 0 4-2 6-6 6H10c-4 0-6-2-6-6C6 26 14 14 28 12Z'
	return (
		<StickerShell d={d} active={active} className={className} {...rest}>
			<HangBow cy={11} />
			<g
				fill="none"
				stroke={ink}
				strokeWidth={1.15}
				strokeLinecap="round"
				strokeLinejoin="round"
				transform="translate(0,2)"
			>
				{/* 扇骨暗示 */}
				<path d="M28 18v30" opacity={0.35} />
				<path d="M28 20c-8 6-12 16-12 28" opacity={0.3} />
				<path d="M28 20c8 6 12 16 12 28" opacity={0.3} />
				{/* 瓶身 */}
				<path d="M22 34h12v14c0 3-2.5 5-6 5s-6-2-6-5Z" fill={soft} fillOpacity={0.18} />
				<path d="M24 34v-3h8v3" />
				<path d="M23 31h10" />
				<rect x="25" y="27" width="6" height="4" rx="0.8" fill={soft} fillOpacity={0.3} />
				<rect x="24.5" y="38" width="7" height="5" rx="0.5" />
				<path d="M36 28l7-9" />
				<path d="M36 28l2.5-1.2 1.2 2.5" />
			</g>
		</StickerShell>
	)
}

/** 文件 · Fichiers — 梯形行李牌 + 台历 */
export function TagFiles({ active, className, ...rest }: TagSvgProps) {
	// 上窄下宽、顶角切角（行李吊牌感）
	const d = 'M16 14h24l6 8v36c0 2.5-2 4.5-4.5 4.5h-27C12 62.5 10 60.5 10 58V22Z'
	return (
		<StickerShell d={d} active={active} className={className} {...rest}>
			<HangBow cy={12} />
			<g fill="none" stroke={ink} strokeWidth={1.15} strokeLinecap="round" strokeLinejoin="round">
				{/* 台历 */}
				<path d="M18 30h20v22H18Z" fill={soft} fillOpacity={0.16} />
				<path d="M18 36h20" />
				<path d="M23 27v6M33 27v6" />
				<path d="M22 42h4M28 42h4M34 42h2M22 48h4M28 48h4" />
			</g>
		</StickerShell>
	)
}

/** 想法 · Pensées — 花边圆 + 玫瑰 */
const THOUGHTS_SCALLOP =
	'M28.0 13.2 L37.0 19.3 L47.4 22.5 L48.3 33.4 L52.2 43.5 L44.3 51.0 L38.8 60.3 L28.0 58.8 L17.2 60.3 L11.7 51.0 L3.8 43.5 L7.7 33.4 L8.6 22.5 L19.0 19.3 L28.0 13.2Z'

export function TagThoughts({ active, className, ...rest }: TagSvgProps) {
	const d = THOUGHTS_SCALLOP
	return (
		<svg
			viewBox="0 0 56 72"
			className={cn('rv-ribbon-sticker h-full w-full overflow-visible', className)}
			aria-hidden
			{...rest}
		>
			<path
				d={d}
				fill={active ? activeFill : fill}
				stroke="#fff"
				strokeWidth={5.5}
				strokeLinejoin="round"
				paintOrder="stroke fill"
				className="rv-tag-shape"
			/>
			<path
				d={d}
				fill="none"
				stroke={ink}
				strokeWidth={1.15}
				strokeLinejoin="round"
				className="rv-tag-outline"
			/>
			<g fill="none" stroke={ink} strokeWidth={1.1} strokeLinecap="round">
				<path d="M28 0v12" stroke="var(--sidebar-string)" strokeWidth={1} />
				<circle cx={28} cy={14} r={2.2} fill={fill} />
				<path
					d="M22 13c1.5-3 4-3 6-1 2-2 4.5-2 6 1-1.8 1.2-3.8.8-6-.2-2.2 1-4.2 1.4-6 .2z"
					fill={soft}
					fillOpacity={0.35}
					stroke={ink}
				/>
			</g>
			<g
				fill="none"
				stroke={ink}
				strokeWidth={1.15}
				strokeLinecap="round"
				strokeLinejoin="round"
				transform="translate(0,2)"
			>
				<path
					d="M28 32c-2 0-4 2-4 4.5S26 42 28 44c2-2 4-5 4-7.5S30 32 28 32z"
					fill={soft}
					fillOpacity={0.28}
				/>
				<path d="M28 36c1.5-1 3-.5 3.5 1M25 38c.5-1.5 2-2 3-1.5" />
				<path d="M28 44v8" />
				<path d="M28 48c-5-1-7 3-6 5M28 50c5-1 7 2 6 4" />
			</g>
		</svg>
	)
}

/** 行情 · Étoiles — 波浪底 + 星 */
export function TagMarkets({ active, className, ...rest }: TagSvgProps) {
	const d =
		'M11 17c0-7 7.5-13 17-13s17 6 17 13v36c-3 3-6 1.5-8.5 3.5S32 62 28 62s-5.5-3.5-8.5-5.5S14 56 11 53Z'
	return (
		<StickerShell d={d} active={active} className={className} {...rest}>
			<HangBow />
			<g
				fill={soft}
				fillOpacity={0.35}
				stroke={ink}
				strokeWidth={1.15}
				strokeLinejoin="round"
				transform="translate(0,4)"
			>
				{/* 五角星 */}
				<path d="M28 28l3.2 6.6 7.3.8-5.4 5 1.5 7.1L28 44.2l-6.6 3.3 1.5-7.1-5.4-5 7.3-.8Z" />
				{/* 小火花 */}
				<path
					d="M40 34l1.2 2.4 2.6.3-2 1.8.5 2.5-2.3-1.2-2.3 1.2.5-2.5-2-1.8 2.6-.3Z"
					fillOpacity={0.5}
					transform="scale(0.55) translate(38,28)"
				/>
			</g>
		</StickerShell>
	)
}

/** 管理 · Clef — 心形 + 钥匙 */
export function TagAdmin({ active, className, ...rest }: TagSvgProps) {
	// 经典心形，顶部留挂点
	const d =
		'M28 64C12 50 6 40 6 28 6 18 14 12 22 12c4 0 7 2 6 4 1-2 4-4 8-4 8 0 16 6 16 16 0 12-6 22-24 36z'
	return (
		<svg
			viewBox="0 0 56 72"
			className={cn('rv-ribbon-sticker h-full w-full overflow-visible', className)}
			aria-hidden
			{...rest}
		>
			<path
				d={d}
				fill={active ? activeFill : fill}
				stroke="#fff"
				strokeWidth={5.5}
				strokeLinejoin="round"
				paintOrder="stroke fill"
				className="rv-tag-shape"
			/>
			<path
				d={d}
				fill="none"
				stroke={ink}
				strokeWidth={1.15}
				strokeLinejoin="round"
				className="rv-tag-outline"
			/>
			<g fill="none" stroke={ink} strokeWidth={1.1} strokeLinecap="round">
				<path d="M28 0v8" stroke="var(--sidebar-string)" strokeWidth={1} />
				<circle cx={28} cy={10} r={2.1} fill={fill} />
				<path
					d="M22 9c1.5-3 4-3 6-1 2-2 4.5-2 6 1-1.8 1.2-3.8.8-6-.2-2.2 1-4.2 1.4-6 .2z"
					fill={soft}
					fillOpacity={0.35}
					stroke={ink}
				/>
			</g>
			{/* 钥匙线稿 */}
			<g
				fill="none"
				stroke={ink}
				strokeWidth={1.2}
				strokeLinecap="round"
				strokeLinejoin="round"
				transform="translate(0,2)"
			>
				<circle cx={24} cy={32} r={5} fill={soft} fillOpacity={0.2} />
				<circle cx={24} cy={32} r={2} />
				<path d="M28.5 34.5L40 46" />
				<path d="M36 42l4 1.5M38 44.5l3-.5" />
			</g>
		</svg>
	)
}

/** 个人 · Moi — 椭圆 Cameo 框 + 侧影 */
export function TagProfile({ active, className, ...rest }: TagSvgProps) {
	const d = 'M28 8c12 0 20 10 20 28S40 64 28 64 8 54 8 36 16 8 28 8z'
	return (
		<svg
			viewBox="0 0 56 72"
			className={cn('rv-ribbon-sticker h-full w-full overflow-visible', className)}
			aria-hidden
			{...rest}
		>
			<path
				d={d}
				fill={active ? activeFill : fill}
				stroke="#fff"
				strokeWidth={5.5}
				strokeLinejoin="round"
				paintOrder="stroke fill"
				className="rv-tag-shape"
			/>
			<path d={d} fill="none" stroke={ink} strokeWidth={1.15} className="rv-tag-outline" />
			{/* 内椭圆框 */}
			<ellipse
				cx={28}
				cy={38}
				rx={14}
				ry={18}
				fill="none"
				stroke={ink}
				strokeWidth={1}
				opacity={0.55}
			/>
			<g fill="none" stroke={ink} strokeWidth={1.1} strokeLinecap="round">
				<path d="M28 0v6" stroke="var(--sidebar-string)" strokeWidth={1} />
				<circle cx={28} cy={8} r={2.1} fill={fill} />
			</g>
			{/* 侧影 */}
			<g fill={soft} fillOpacity={0.45} stroke={ink} strokeWidth={1.05} strokeLinejoin="round">
				<path d="M26 28c2-4 7-5 9-2 1.5 2 .5 4-1 5 2 1 3 3 2.5 5.5-.5 3-3 5-6 5s-5.5-2-6-5c-.5-2.5.5-4.5 2.5-5.5-1-1.2-1.5-2.5-1-3z" />
				<path d="M22 48c2-4 6-6 10-6s8 2 10 6" fill="none" />
			</g>
		</svg>
	)
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
