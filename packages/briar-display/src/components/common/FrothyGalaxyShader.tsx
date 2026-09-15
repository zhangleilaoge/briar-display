'use client'

import { useEffect, useRef } from 'react'

const vertexShaderSource = `
attribute vec2 position;
void main() {
	gl_Position = vec4(position, 0.0, 1.0);
}
`

const fragmentShaderSource = `
precision highp float;
uniform vec2 resolution;
uniform float time;

float hash(vec2 p) {
	p = fract(p * vec2(123.34, 456.21));
	p += dot(p, p + 45.32);
	return fract(p.x * p.y);
}

float noise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);

	float a = hash(i);
	float b = hash(i + vec2(1.0, 0.0));
	float c = hash(i + vec2(0.0, 1.0));
	float d = hash(i + vec2(1.0, 1.0));

	return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
	float value = 0.0;
	float amplitude = 0.5;
	float frequency = 1.0;

	for (int i = 0; i < 5; i++) {
		value += amplitude * noise(p * frequency);
		frequency *= 2.0;
		amplitude *= 0.5;
	}
	return value;
}

void main() {
	vec2 uv = gl_FragCoord.xy / resolution.xy;
	vec2 p = (uv - 0.5) * 2.0;
	p.x *= resolution.x / resolution.y;

	// Smooth flowing waves
	float wave1 = sin(p.x * 2.0 + time * 0.5) * 0.3;
	float wave2 = sin(p.x * 1.5 - p.y * 0.8 + time * 0.4) * 0.2;
	float wave3 = sin(p.x * 3.0 + p.y * 1.5 + time * 0.6) * 0.15;
	float waves = wave1 + wave2 + wave3;

	// Add noise detail
	waves += fbm(p * 2.0 + vec2(time * 0.1, 0.0)) * 0.2;

	// Normalized wave height
	float h = waves * 0.5 + 0.5;

	// Beautiful gradient colors
	vec3 color1 = vec3(0.58, 0.72, 0.88);  // Soft blue
	vec3 color2 = vec3(0.70, 0.82, 0.93);  // Light blue
	vec3 color3 = vec3(0.82, 0.90, 0.96);  // Pale blue
	vec3 color4 = vec3(0.93, 0.96, 0.99);  // Near white

	// Smooth color transitions
	vec3 color;
	if (h < 0.33) {
		color = mix(color1, color2, h * 3.0);
	} else if (h < 0.66) {
		color = mix(color2, color3, (h - 0.33) * 3.0);
	} else {
		color = mix(color3, color4, (h - 0.66) * 3.0);
	}

	// Add shimmer
	float shimmer = fbm(p * 6.0 + vec2(time * 0.3, time * 0.2));
	shimmer = pow(shimmer, 2.0) * 0.3;
	color += vec3(shimmer);

	// Depth fade
	color = mix(color, color1, (1.0 - uv.y) * 0.35);

	// Subtle vignette
	float dist = length(uv - 0.5);
	color *= 1.0 - dist * 0.15;

	gl_FragColor = vec4(color, 1.0);
}
`

export default function FrothyGalaxyShader() {
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const containerRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		const canvas = canvasRef.current
		const container = containerRef.current
		if (!canvas || !container) return

		const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
		if (!gl) return

		// 背景 shader 不需要满分辨率渲染，限制 DPR 控制全屏片元开销
		const dpr = Math.min(window.devicePixelRatio || 1, 1.5)

		const resizeCanvas = () => {
			const rect = container.getBoundingClientRect()
			canvas.width = Math.max(1, Math.round(rect.width * dpr))
			canvas.height = Math.max(1, Math.round(rect.height * dpr))
			gl.viewport(0, 0, canvas.width, canvas.height)
		}

		resizeCanvas()
		window.addEventListener('resize', resizeCanvas)

		const createShader = (type: number, source: string) => {
			const shader = gl.createShader(type)
			if (!shader) return null

			gl.shaderSource(shader, source)
			gl.compileShader(shader)

			if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
				console.error('Shader compile error:', gl.getShaderInfoLog(shader))
				gl.deleteShader(shader)
				return null
			}

			return shader
		}

		const vertexShader = createShader(gl.VERTEX_SHADER, vertexShaderSource)
		const fragmentShader = createShader(gl.FRAGMENT_SHADER, fragmentShaderSource)
		if (!vertexShader || !fragmentShader) return

		const program = gl.createProgram()
		if (!program) return

		gl.attachShader(program, vertexShader)
		gl.attachShader(program, fragmentShader)
		gl.linkProgram(program)

		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			console.error('Program link error:', gl.getProgramInfoLog(program))
			return
		}

		const positionBuffer = gl.createBuffer()
		gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)

		const positionLocation = gl.getAttribLocation(program, 'position')
		const resolutionLocation = gl.getUniformLocation(program, 'resolution')
		const timeLocation = gl.getUniformLocation(program, 'time')

		let animationId = 0
		const startTime = performance.now()

		const render = () => {
			gl.clearColor(0, 0, 0, 1)
			gl.clear(gl.COLOR_BUFFER_BIT)

			gl.useProgram(program)

			gl.enableVertexAttribArray(positionLocation)
			gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
			gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)

			gl.uniform2f(resolutionLocation, canvas.width, canvas.height)
			gl.uniform1f(timeLocation, (performance.now() - startTime) / 1000)

			gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

			animationId = requestAnimationFrame(render)
		}

		render()

		return () => {
			window.removeEventListener('resize', resizeCanvas)
			cancelAnimationFrame(animationId)
			gl.deleteProgram(program)
			gl.deleteShader(vertexShader)
			gl.deleteShader(fragmentShader)
			gl.deleteBuffer(positionBuffer)
		}
	}, [])

	return (
		<div ref={containerRef} className="absolute inset-0 h-full w-full overflow-hidden bg-black">
			<canvas ref={canvasRef} className="absolute top-0 left-0 h-full w-full" />
		</div>
	)
}
