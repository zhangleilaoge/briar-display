export const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
	const buffer = bytes.buffer
	if (buffer instanceof ArrayBuffer) {
		if (bytes.byteOffset === 0 && bytes.byteLength === buffer.byteLength) return buffer
		return buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
	}
	const copy = new ArrayBuffer(bytes.byteLength)
	new Uint8Array(copy).set(bytes)
	return copy
}
