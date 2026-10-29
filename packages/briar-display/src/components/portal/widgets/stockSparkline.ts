export interface SparklineGeometry {
	points: string
	baselineY: number | null
}

export function sparklineGeometry(
	values: number[],
	baseline?: number | null,
	width = 100,
	height = 36,
	padding = 2,
): SparklineGeometry {
	if (values.length < 2) return { points: '', baselineY: null }
	const reference = baseline != null && Number.isFinite(baseline) ? baseline : null
	const min = Math.min(...values, ...(reference != null ? [reference] : []))
	const max = Math.max(...values, ...(reference != null ? [reference] : []))
	const span = max - min || 1
	const toY = (value: number) => padding + (1 - (value - min) / span) * (height - padding * 2)
	return {
		points: values
			.map((value, index) => {
				const x = padding + (index / (values.length - 1)) * (width - padding * 2)
				return `${x.toFixed(2)},${toY(value).toFixed(2)}`
			})
			.join(' '),
		baselineY: reference != null ? toY(reference) : null,
	}
}
