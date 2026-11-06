import { useEffect, useMemo } from 'react'
import * as THREE from 'three'

interface ThreadedRingProps {
	radius?: number
	tube?: number
	depth?: number
}

export function ThreadedRing({ radius = 0.18, tube = 0.032, depth = 0.05 }: ThreadedRingProps) {
	const geometry = useMemo(() => {
		const ring = new THREE.TorusGeometry(radius, tube, 12, 64)
		const positions = ring.getAttribute('position')
		for (let index = 0; index < positions.count; index++) {
			const y = positions.getY(index)
			positions.setZ(index, positions.getZ(index) - Math.tanh(y / (radius * 0.2)) * depth)
		}
		positions.needsUpdate = true
		ring.computeVertexNormals()
		return ring
	}, [radius, tube, depth])
	useEffect(() => () => geometry.dispose(), [geometry])
	return (
		<mesh geometry={geometry} castShadow>
			<meshStandardMaterial color="#737874" metalness={0.9} roughness={0.24} />
		</mesh>
	)
}
