import { useMemo } from 'react'
import { type SectionSvgProjection, sectionToSvgPaths } from './toolSectionSvg'
import { type Plane, type Section, type Vec3, voxelKey } from './toolSectionUtils'

const POINT_COLORS = ['#b82e39', '#b86a2a', '#275891']

export function SectionSvgShapes({ svg }: { svg: SectionSvgProjection }) {
	return (
		<>
			{svg.paths.map((path) => (
				<path
					key={voxelKey(path.voxel)}
					d={path.d}
					fill={path.color === 'gray' ? '#1c2a4a' : '#f4f7fc'}
					data-section-fill={voxelKey(path.voxel)}
				/>
			))}
			{svg.outlines.map((d, index) => (
				<path
					key={`${d}-${index}`}
					d={d}
					fill="none"
					stroke="#1c2a4a"
					strokeWidth={2}
					strokeLinejoin="round"
					data-section-outline
				/>
			))}
		</>
	)
}

export function SectionSvgPreview({
	section,
	plane,
	points,
	size = 140,
	rotation = 0,
	reflectX = false,
	reflectY = false,
}: {
	section: Section
	plane: Plane
	points?: Vec3[]
	size?: number
	rotation?: number
	reflectX?: boolean
	reflectY?: boolean
}) {
	const svg = useMemo(
		() => sectionToSvgPaths(section, plane, size, points, rotation, { x: reflectX, y: reflectY }),
		[section, plane, size, points, rotation, reflectX, reflectY],
	)
	return (
		<svg
			width={svg.width}
			height={svg.height}
			viewBox={`0 0 ${svg.width} ${svg.height}`}
			className="max-w-full rounded-md border bg-white"
			aria-label="当前截面的二维展开图"
			data-rotation={rotation}
			data-reflect-x={reflectX}
			data-reflect-y={reflectY}
		>
			<SectionSvgShapes svg={svg} />
			{svg.markers.map((marker, index) => (
				<g key={marker.id} data-cut-point={marker.id}>
					<circle cx={marker.x} cy={marker.y} r={5} fill={POINT_COLORS[index]} stroke="white" />
					<text
						x={marker.x + 8}
						y={marker.y + 4}
						fill={POINT_COLORS[index]}
						fontSize={12}
						fontWeight={700}
					>
						{marker.id}
					</text>
				</g>
			))}
		</svg>
	)
}
