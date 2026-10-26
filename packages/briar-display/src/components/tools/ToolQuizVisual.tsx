import { useMemo } from 'react'
import { SectionSvgPreview } from './ToolSectionPreview'
import type { QuizVisual } from './toolSectionQuizTypes'
import {
	DEFAULT_SOLID_VIEW,
	type SolidPreviewFace,
	solidPreviewFaces,
} from './toolSectionSolidPreview'
import type { GridDiagram } from './toolSectionSolids'
import type { Solid, Vec3, VoxelColor } from './toolSectionUtils'

const FACE_COLORS = ['#0f172a', '#475569', '#0f766e', '#0369a1', '#b45309', '#be123c']

function fillFor(color: VoxelColor, role: SolidPreviewFace['role']): string {
	if (color === 'gray') {
		return role === 'y' ? '#475569' : role === 'x' ? '#1f2937' : '#334155'
	}
	return role === 'y' ? '#f8fafc' : role === 'x' ? '#cbd5e1' : '#e2e8f0'
}

export function SolidSvgPreview({
	solid,
	size = 128,
	viewDirection,
}: {
	solid: Solid
	size?: number
	viewDirection?: Vec3
}) {
	const direction = viewDirection ?? DEFAULT_SOLID_VIEW
	const svg = useMemo(() => {
		const projected = solidPreviewFaces(solid, direction)
		const all = projected.flatMap((face) => face.points)
		const xs = all.map((point) => point[0])
		const ys = all.map((point) => point[1])
		const minX = Math.min(...xs)
		const maxX = Math.max(...xs)
		const minY = Math.min(...ys)
		const maxY = Math.max(...ys)
		const span = Math.max(maxX - minX, maxY - minY, 1e-9)
		const scale = (size - 20) / span
		const offsetX = (size - (maxX - minX) * scale) / 2
		const offsetY = (size - (maxY - minY) * scale) / 2
		return projected.map((face) => ({
			...face,
			d: face.points
				.map(([x, y], index) => {
					const px = offsetX + (x - minX) * scale
					const py = offsetY + (y - minY) * scale
					return `${index === 0 ? 'M' : 'L'}${px.toFixed(1)} ${py.toFixed(1)}`
				})
				.join(' '),
		}))
	}, [solid, size, direction])
	return (
		<svg
			width={size}
			height={size}
			className="rounded border bg-white"
			data-option-visual="solid"
			data-view-direction={direction.map((value) => value.toFixed(4)).join(',')}
		>
			{svg.map((face, index) => (
				<path
					key={`${face.normal.join(',')}-${index}`}
					d={`${face.d} Z`}
					fill={fillFor(face.color, face.role)}
					stroke="#334155"
					strokeWidth={1.2}
					strokeLinejoin="round"
				/>
			))}
		</svg>
	)
}

export function GridSvgPreview({ grid, size = 128 }: { grid: GridDiagram; size?: number }) {
	const unit = (size - 16) / Math.max(grid.rows, grid.cols, 1)
	const width = grid.cols * unit
	const height = grid.rows * unit
	const offsetX = (size - width) / 2
	const offsetY = (size - height) / 2
	return (
		<svg width={size} height={size} className="rounded border bg-white" data-option-visual="grid">
			{grid.cells.map((cell) => {
				const x = offsetX + cell.col * unit
				const y = offsetY + cell.row * unit
				const colorIndex = cell.label ? 'ABCDEF'.indexOf(cell.label) : -1
				return (
					<g key={`${cell.row}-${cell.col}-${cell.label ?? ''}`}>
						<rect
							x={x}
							y={y}
							width={unit}
							height={unit}
							fill={
								cell.color === 'gray'
									? '#1f2937'
									: colorIndex >= 0
										? FACE_COLORS[colorIndex]
										: '#f8fafc'
							}
							stroke="#334155"
							strokeWidth={1.5}
						/>
						{cell.label ? (
							<text
								x={x + unit / 2}
								y={y + unit / 2 + unit * 0.16}
								textAnchor="middle"
								fill="#ffffff"
								fontSize={unit * 0.48}
								fontWeight={700}
							>
								{cell.label}
							</text>
						) : null}
					</g>
				)
			})}
		</svg>
	)
}

function ValueSvgPreview({
	value,
	caption,
	size,
}: {
	value: string
	caption?: string
	size: number
}) {
	return (
		<svg width={size} height={size} className="rounded border bg-white" data-option-visual="value">
			<text
				x="50%"
				y={caption ? '48%' : '58%'}
				textAnchor="middle"
				fontSize={size * 0.36}
				fontWeight={700}
				fill="#1e293b"
			>
				{value}
			</text>
			{caption ? (
				<text x="50%" y="72%" textAnchor="middle" fontSize={size * 0.11} fill="#64748b">
					{caption}
				</text>
			) : null}
		</svg>
	)
}

function FacesSvgPreview({ labels, size }: { labels: [string, string]; size: number }) {
	const tile = size * 0.32
	const gap = size * 0.08
	const start = (size - tile * 2 - gap) / 2
	const y = (size - tile) / 2
	return (
		<svg width={size} height={size} className="rounded border bg-white" data-option-visual="faces">
			{labels.map((label, index) => {
				const x = start + index * (tile + gap)
				const color = FACE_COLORS[Math.max(0, 'ABCDEF'.indexOf(label))]
				return (
					<g key={label}>
						<rect
							x={x}
							y={y}
							width={tile}
							height={tile}
							fill={color}
							stroke="#334155"
							strokeWidth={1.5}
						/>
						<text
							x={x + tile / 2}
							y={y + tile / 2 + tile * 0.16}
							textAnchor="middle"
							fill="#ffffff"
							fontSize={tile * 0.48}
							fontWeight={700}
						>
							{label}
						</text>
					</g>
				)
			})}
		</svg>
	)
}

export function QuizOptionVisual({
	visual,
	size = 128,
	viewDirection,
}: {
	visual: QuizVisual
	size?: number
	viewDirection?: Vec3
}) {
	switch (visual.kind) {
		case 'section':
			return <SectionSvgPreview section={visual.section} plane={visual.diagramPlane} size={size} />
		case 'grid':
			return <GridSvgPreview grid={visual.grid} size={size} />
		case 'solid':
			return <SolidSvgPreview solid={visual.solid} size={size} viewDirection={viewDirection} />
		case 'value':
			return <ValueSvgPreview value={visual.value} caption={visual.caption} size={size} />
		case 'faces':
			return <FacesSvgPreview labels={visual.labels} size={size} />
	}
}
