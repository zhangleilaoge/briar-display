declare module 'upng-js' {
	export function encode(
		imgs: ArrayBuffer[],
		w: number,
		h: number,
		cnum: number,
		dels?: number[],
	): ArrayBuffer
	export function decode(buffer: ArrayBuffer): {
		width: number
		height: number
		depth: number
		ctype: number
		compression: number
		interlace: number
		frames: {
			data: ArrayBuffer
			left: number
			top: number
			width: number
			height: number
			delay: number
			dispose: number
			blend: number
		}[]
		data: ArrayBuffer
	}
	export function toRGBA8(decoded: ReturnType<typeof decode>): ArrayBuffer[]
}
