import { useMemo } from 'react'
import { type Plane, type Section, sectionToSvgPaths } from './toolSectionUtils'

export function SectionSvgPreview({
	section,
	plane,
	size = 140,
}: {
	section: Section
	plane: Plane
	size?: number
}) {
	const svg = useMemo(() => sectionToSvgPaths(section, plane, size), [section, plane, size])
	return (
		<svg
			width={svg.width}
			height={svg.height}
			viewBox={`0 0 ${svg.width} ${svg.height}`}
			className="max-w-full rounded-md border bg-white"
			aria-label="当前截面的二维展开图"
		>
			{svg.paths.map((path, index) => (
				<path
					key={`${path.d}-${index}`}
					d={path.d}
					fill={path.color === 'gray' ? '#9ca3af' : '#f8fafc'}
					stroke="#1e293b"
					strokeWidth={2}
				/>
			))}
		</svg>
	)
}
