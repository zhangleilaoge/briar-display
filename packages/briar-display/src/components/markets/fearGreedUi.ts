import { type FearGreedBand, fearGreedBand, fearGreedLabel } from '@briar/shared'

/** 0 → 绿（恐惧，色相 140），100 → 红（贪婪，色相 0），与红涨绿跌一致 */
export function fearGreedHue(score: number): number {
	const s = Math.min(100, Math.max(0, score))
	return Math.round(140 * (1 - s / 100))
}

export type FearGreedStyle = {
	backgroundColor: string
	color: string
	borderColor: string
}

/** 徽章配色；没有分数时为灰 */
export function fearGreedStyle(score: number | null | undefined): FearGreedStyle {
	if (score == null || !Number.isFinite(score)) {
		return {
			backgroundColor: 'hsl(220 10% 94%)',
			color: 'hsl(220 8% 45%)',
			borderColor: 'hsl(220 10% 88%)',
		}
	}
	const h = fearGreedHue(score)
	return {
		backgroundColor: `hsl(${h} 75% 93%)`,
		color: `hsl(${h} 70% 30%)`,
		borderColor: `hsl(${h} 60% 80%)`,
	}
}

/** 分项条形图颜色（纯色） */
export const fearGreedBarColor = (score: number) => `hsl(${fearGreedHue(score)} 65% 48%)`

/** 「62 贪婪」/「—」 */
export function fearGreedText(score: number | null | undefined): {
	value: string
	band: FearGreedBand | null
	label: string
} {
	if (score == null || !Number.isFinite(score)) return { value: '—', band: null, label: '' }
	const band = fearGreedBand(score)
	return { value: String(Math.round(score)), band, label: fearGreedLabel(band) }
}
