/**
 * Reverie 主题装饰插画：全部为本仓库自绘 SVG（无外部素材，随仓库 MIT/自有授权）。
 * 线稿用 currentColor，可通过 text-* 着色；填充色取主题 token。
 */
import { cn } from '@/lib/utils'
import { type SVGProps, useId } from 'react'

type IconProps = SVGProps<SVGSVGElement>

/* ---------------- 侧栏浮雕小图标（24×24 线稿） ---------------- */

export function BowIcon(props: IconProps) {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} {...props}>
			<path d="M12 11c-2.5-3.2-6.8-4.6-8-3 -1.1 1.5.3 5 3 5.6 1.9.4 3.8-.9 5-2.6Z" />
			<path d="M12 11c2.5-3.2 6.8-4.6 8-3 1.1 1.5-.3 5-3 5.6-1.9.4-3.8-.9-5-2.6Z" />
			<path d="M10.6 12.2 8 19l2-1 1 2 1-7.4M13.4 12.2 16 19l-2-1-1 2" />
			<circle cx="12" cy="11.4" r="1.4" fill="currentColor" />
		</svg>
	)
}

export function InkwellIcon(props: IconProps) {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} {...props}>
			<path d="M9 5h6v2.2c2.6.8 4 2.6 4 5.3V19a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-6.5c0-2.7 1.4-4.5 4-5.3Z" />
			<path d="M8.5 3.5h7M7 14h10" />
			<path d="M15.5 2.5 20 0.8" strokeLinecap="round" />
			<path d="M9.5 17c1.5-1 3.5-1 5 0" strokeLinecap="round" />
		</svg>
	)
}

export function CameoIcon(props: IconProps) {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} {...props}>
			<ellipse cx="12" cy="12" rx="7" ry="9" />
			<ellipse cx="12" cy="12" rx="5" ry="6.8" strokeDasharray="1 1.6" />
			<path d="M13.6 7.4c-1.8-.6-3.6.6-3.6 2.6 0 .9-.9 1.2-.9 1.8s.8.4.8 1.2c0 1 .6 1.4 1.6 1.4.2 1.2-.6 1.9-1.7 2.4M13.6 7.4c1 .9 1.2 2.6.4 4" />
		</svg>
	)
}

export function FanIcon(props: IconProps) {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} {...props}>
			<path d="M12 19 3.2 9.6A12 12 0 0 1 20.8 9.6Z" />
			<path
				d="M12 19 7.4 5.6M12 19V4.2M12 19l4.6-13.4M12 19 4.8 7.3M12 19l7.2-11.7"
				strokeWidth={0.9}
			/>
			<circle cx="12" cy="19" r="1.2" fill="currentColor" />
		</svg>
	)
}

export function StarIcon(props: IconProps) {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} {...props}>
			<path d="m12 3 2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7Z" />
			<path
				d="m12 7.4 1.2 2.6 2.8.3-2.1 1.9.6 2.8-2.5-1.4-2.5 1.4.6-2.8L8 10.3l2.8-.3Z"
				strokeWidth={0.8}
			/>
		</svg>
	)
}

export function KeyIcon(props: IconProps) {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} {...props}>
			<circle cx="8" cy="8" r="4.2" />
			<circle cx="8" cy="8" r="1.6" />
			<path d="m11 11 9 9M16.5 16.5l2-2M18.6 18.6l1.4-1.4" strokeLinecap="round" />
		</svg>
	)
}

export function RoseIcon(props: IconProps) {
	return (
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} {...props}>
			<path d="M12 4c3.6 0 6 2.3 6 5.4S15.4 15 12 15s-6-2.3-6-5.6S8.4 4 12 4Z" />
			<path d="M12 6.5c1.8.1 3 1.3 3 2.8 0 1.7-1.4 2.6-3 2.6s-2.6-1-2.6-2.4c0-1.1.9-1.8 2-1.8" />
			<path d="M12 15v6M12 18c-1.6-1.8-3.6-1.9-5-1 1.2 1.6 3.2 1.9 5 1ZM12 19c1.5-1.4 3.3-1.4 4.6-.6-1.1 1.3-2.9 1.5-4.6.6Z" />
		</svg>
	)
}

/* ---------------- 剪贴簿插画 ---------------- */

/** 草莓（带叶）：用户气泡 / 便签角饰 */
export function Strawberry({ className, ...props }: IconProps) {
	return (
		<svg viewBox="0 0 48 56" className={cn('drop-shadow-sm', className)} {...props}>
			<path
				d="M24 14c10 0 18 5 17 15-1 12-10 24-17 24S8 41 7 29C6 19 14 14 24 14Z"
				fill="#e8828f"
				stroke="#b9545f"
				strokeWidth="1.2"
			/>
			<path
				d="M24 14c10 0 18 5 17 15-.4 4.6-2 9.2-4.2 13"
				fill="none"
				stroke="#f6b9c0"
				strokeWidth="2"
				opacity=".7"
			/>
			{[
				[16, 26],
				[24, 24],
				[32, 26],
				[13, 34],
				[21, 33],
				[29, 33],
				[36, 34],
				[17, 41],
				[25, 42],
				[32, 41],
				[21, 48],
				[28, 48],
			].map(([x, y]) => (
				<ellipse key={`${x}-${y}`} cx={x} cy={y} rx="1" ry="1.5" fill="#fbe7a6" />
			))}
			<path
				d="M24 16c-3-4-9-5-12-3 3 0 5 1 6 3-4-1-7 0-9 2 4 0 7 0 9 1-2 1-3 3-3 5 3-2 6-4 9-5 3 1 6 3 9 5 0-2-1-4-3-5 2-1 5-1 9-1-2-2-5-3-9-2 1-2 3-3 6-3-3-2-9-1-12 3Z"
				fill="#8fb48a"
				stroke="#5f8a5b"
				strokeWidth="1"
			/>
			<path
				d="M24 15c0-4 1-8 4-11"
				fill="none"
				stroke="#5f8a5b"
				strokeWidth="1.6"
				strokeLinecap="round"
			/>
		</svg>
	)
}

/** 怀表 */
export function PocketWatch({ className, ...props }: IconProps) {
	return (
		<svg viewBox="0 0 64 80" className={className} {...props}>
			<path d="M32 4a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z" fill="none" stroke="#9a8f86" strokeWidth="2" />
			<rect x="28" y="12" width="8" height="6" rx="1.5" fill="#cfc6bd" stroke="#8c8178" />
			<circle cx="32" cy="46" r="27" fill="#d9d2ca" stroke="#8c8178" strokeWidth="1.5" />
			<circle cx="32" cy="46" r="23" fill="#fdfbf7" stroke="#b3a89e" />
			{Array.from({ length: 12 }, (_, i) => {
				const a = (i * Math.PI) / 6
				return (
					<line
						key={i}
						x1={32 + Math.sin(a) * 19}
						y1={46 - Math.cos(a) * 19}
						x2={32 + Math.sin(a) * 21.5}
						y2={46 - Math.cos(a) * 21.5}
						stroke="#2c3549"
						strokeWidth={i % 3 === 0 ? 1.6 : 0.8}
					/>
				)
			})}
			<path d="M32 46V32M32 46l8 5" stroke="#2c3549" strokeWidth="1.6" strokeLinecap="round" />
			<circle cx="32" cy="46" r="1.6" fill="#2c3549" />
		</svg>
	)
}

/** 钢笔 */
export function FountainPen({ className, ...props }: IconProps) {
	return (
		<svg viewBox="0 0 120 40" className={className} {...props}>
			<g transform="rotate(-18 60 20)">
				<rect x="18" y="15" width="70" height="10" rx="5" fill="#2c3549" />
				<rect x="40" y="15" width="6" height="10" fill="#c9a96a" />
				<rect x="84" y="16.5" width="14" height="7" rx="2" fill="#c9a96a" />
				<path d="M98 16.5 114 20l-16 3.5Z" fill="#d9cdb4" stroke="#9b8a66" strokeWidth=".8" />
				<path d="M101 20h11" stroke="#6c5c3e" strokeWidth=".7" />
				<path d="M24 15v-3h22" fill="none" stroke="#c9a96a" strokeWidth="1.6" />
			</g>
		</svg>
	)
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

/** 希腊爱奥尼柱（线稿 + 半透明填充） */
export function GreekColumn({ className, ...props }: IconProps) {
	return (
		<svg viewBox="0 0 120 420" className={className} {...props}>
			<g fill="hsl(210 60% 98% / .55)" stroke="#5d6f96" strokeWidth="1.2">
				<path d="M8 6h104v12H8z" />
				<path d="M14 18h92c0 8-6 12-14 12H28c-8 0-14-4-14-12Z" />
				<circle cx="22" cy="30" r="10" />
				<circle cx="98" cy="30" r="10" />
				<path d="M26 40h68v10H26z" />
				<path d="M30 50h60v330H30z" />
				<path d="M24 380h72v12H24zM16 392h88v12H16zM8 404h104v12H8z" />
			</g>
			<g stroke="#5d6f96" strokeWidth=".8" opacity=".7">
				{[38, 46, 54, 62, 70, 78, 86].map((x) => (
					<line key={x} x1={x} y1="54" x2={x} y2="376" />
				))}
				<circle cx="22" cy="30" r="5" fill="none" />
				<circle cx="98" cy="30" r="5" fill="none" />
			</g>
		</svg>
	)
}
