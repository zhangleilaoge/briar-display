/**
 * 星盘（Astrolabe）：Arcane HUD 风格的旋转装饰。自绘 SVG，无外部素材。
 * - 外环刻度 + 环形文字顺时针慢转，内环逆转；中心菱形内的花体单词轮换淡入。
 * - prefers-reduced-motion 时由 theme.css 关闭动画。
 */
import { cn } from '@/lib/utils'
import { useEffect, useId, useState } from 'react'

/** 服务端与浏览器三角函数末位精度不同，取两位小数避免 hydration 属性不一致 */
const r2 = (n: number) => Math.round(n * 100) / 100

const DEFAULT_RING = '01 TOUT · 02 SÉANCES · 03 MESSAGES · 04 DATES · 05 ARCHIVES · '
const DEFAULT_WORDS = ['Souvenir', 'Archive', 'Miroir', 'Flux']

export interface AstrolabeProps {
	className?: string
	/** 环形文字 */
	ringText?: string
	/** 中心轮换的花体词 */
	words?: string[]
	/** 是否显示中心词 */
	showWord?: boolean
}

export function Astrolabe({
	className,
	ringText = DEFAULT_RING,
	words = DEFAULT_WORDS,
	showWord = true,
}: AstrolabeProps) {
	const uid = useId().replace(/:/g, '')
	const ringId = `rv-astro-ring-${uid}`
	const [index, setIndex] = useState(0)

	useEffect(() => {
		if (!showWord || words.length < 2) return
		const timer = window.setInterval(() => setIndex((i) => (i + 1) % words.length), 4000)
		return () => window.clearInterval(timer)
	}, [showWord, words.length])

	const ticks = Array.from({ length: 72 }, (_, i) => i)

	return (
		<svg
			viewBox="0 0 320 320"
			className={cn('pointer-events-none select-none', className)}
			aria-hidden
		>
			<defs>
				<path id={ringId} d="M160 160m-122 0a122 122 0 1 1 244 0a122 122 0 1 1-244 0" />
				<radialGradient id={`${ringId}-glow`}>
					<stop offset="0%" stopColor="hsl(210 100% 98%)" stopOpacity=".9" />
					<stop offset="100%" stopColor="hsl(210 80% 90%)" stopOpacity="0" />
				</radialGradient>
			</defs>
			<circle cx="160" cy="160" r="150" fill={`url(#${ringId}-glow)`} />
			{/* 外环：刻度 + 文字，慢速顺转 */}
			<g className="rv-spin-slow">
				<circle cx="160" cy="160" r="148" fill="none" stroke="var(--rv-navy)" strokeOpacity=".55" />
				<circle cx="160" cy="160" r="138" fill="none" stroke="var(--rv-navy)" strokeOpacity=".3" />
				{ticks.map((i) => {
					const a = (i * Math.PI) / 36
					const long = i % 6 === 0
					return (
						<line
							key={i}
							x1={r2(160 + Math.sin(a) * 148)}
							y1={r2(160 - Math.cos(a) * 148)}
							x2={r2(160 + Math.sin(a) * (long ? 136 : 142))}
							y2={r2(160 - Math.cos(a) * (long ? 136 : 142))}
							stroke="var(--rv-navy)"
							strokeOpacity={long ? 0.7 : 0.35}
							strokeWidth={long ? 1.2 : 0.7}
						/>
					)
				})}
				<text
					fontFamily="var(--font-label)"
					fontSize="9.5"
					letterSpacing="3.2"
					fill="var(--rv-navy)"
					fillOpacity=".75"
				>
					<textPath href={`#${ringId}`}>{ringText.repeat(2)}</textPath>
				</text>
			</g>
			{/* 内环：虚线 + 菱形标记，逆转 */}
			<g className="rv-spin-rev">
				<circle
					cx="160"
					cy="160"
					r="104"
					fill="none"
					stroke="var(--rv-navy)"
					strokeOpacity=".45"
					strokeDasharray="2 5"
				/>
				<circle cx="160" cy="160" r="92" fill="none" stroke="var(--rv-navy)" strokeOpacity=".25" />
				{[0, 90, 180, 270].map((deg) => (
					<rect
						key={deg}
						x="155"
						y="51"
						width="10"
						height="10"
						transform={`rotate(${deg} 160 160) rotate(45 160 56)`}
						fill="hsl(210 100% 98%)"
						stroke="var(--rv-navy)"
						strokeOpacity=".7"
					/>
				))}
				<path d="M160 70v180M70 160h180" stroke="var(--rv-navy)" strokeOpacity=".18" />
			</g>
			{/* 快速小环 */}
			<g className="rv-spin-fast">
				<circle
					cx="160"
					cy="160"
					r="72"
					fill="none"
					stroke="var(--rv-navy)"
					strokeOpacity=".35"
					strokeDasharray="30 8 2 8"
				/>
			</g>
			{/* 中心菱形 */}
			<g>
				<rect
					x="118"
					y="118"
					width="84"
					height="84"
					transform="rotate(45 160 160)"
					fill="hsl(210 100% 99% / .85)"
					stroke="var(--rv-navy)"
					strokeOpacity=".65"
				/>
				<rect
					x="126"
					y="126"
					width="68"
					height="68"
					transform="rotate(45 160 160)"
					fill="none"
					stroke="var(--rv-navy)"
					strokeOpacity=".3"
				/>
				{showWord && (
					<text
						key={index}
						className="rv-fade-word"
						x="160"
						y="167"
						textAnchor="middle"
						fontFamily="var(--font-script)"
						fontSize="24"
						fill="var(--rv-navy)"
					>
						{words[index % words.length]}
					</text>
				)}
			</g>
		</svg>
	)
}
