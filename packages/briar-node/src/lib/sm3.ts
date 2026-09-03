/**
 * 国密 SM3 摘要算法（纯 TS 实现，无依赖）
 * 用于抖音 web 端 a_bogus 签名（对 query + 盐做两轮 SM3）
 * 测试向量（OpenSSL 验证）：SM3("abc") = 66c7f0f462eeedd9d1f2d46bdc10e4e24167c4875cf2f7a2297da02b8f4ba8e0
 */

const IV = [
	0x7380166f, 0x4914b2b9, 0x172442d7, 0xda8a0600, 0xa96f30bc, 0x163138aa, 0xe38dee4d, 0xb0fb0e4e,
]

/** 循环左移（32 位无符号） */
const rotl = (x: number, n: number): number => {
	const shift = n % 32
	return ((x << shift) | (x >>> (32 - shift))) >>> 0
}

const p0 = (x: number): number => (x ^ rotl(x, 9) ^ rotl(x, 17)) >>> 0
const p1 = (x: number): number => (x ^ rotl(x, 15) ^ rotl(x, 23)) >>> 0

function compress(v: number[], block: Uint8Array, offset: number): void {
	const w = new Array<number>(68)
	for (let i = 0; i < 16; i++) {
		const j = offset + i * 4
		w[i] = ((block[j] << 24) | (block[j + 1] << 16) | (block[j + 2] << 8) | block[j + 3]) >>> 0
	}
	for (let j = 16; j < 68; j++) {
		w[j] = (p1(w[j - 16] ^ w[j - 9] ^ rotl(w[j - 3], 15)) ^ rotl(w[j - 13], 7) ^ w[j - 6]) >>> 0
	}

	let [a, b, c, d, e, f, g, h] = v
	for (let j = 0; j < 64; j++) {
		const t = j < 16 ? 0x79cc4519 : 0x7a879d8a
		const ss1 = rotl((rotl(a, 12) + e + rotl(t, j)) >>> 0, 7)
		const ss2 = ss1 ^ rotl(a, 12)
		const ff = j < 16 ? a ^ b ^ c : (a & b) | (a & c) | (b & c)
		const gg = j < 16 ? e ^ f ^ g : (e & f) | (~e & g)
		const tt1 = (ff + d + ss2 + (w[j] ^ w[j + 4])) >>> 0
		const tt2 = (gg + h + ss1 + w[j]) >>> 0
		d = c
		c = rotl(b, 9)
		b = a
		a = tt1
		h = g
		g = rotl(f, 19)
		f = e
		e = p0(tt2)
	}

	v[0] = (v[0] ^ a) >>> 0
	v[1] = (v[1] ^ b) >>> 0
	v[2] = (v[2] ^ c) >>> 0
	v[3] = (v[3] ^ d) >>> 0
	v[4] = (v[4] ^ e) >>> 0
	v[5] = (v[5] ^ f) >>> 0
	v[6] = (v[6] ^ g) >>> 0
	v[7] = (v[7] ^ h) >>> 0
}

/** SM3 摘要：输入字节，输出 32 字节摘要 */
export function sm3(data: Uint8Array): Uint8Array {
	const bitLen = data.length * 8
	// 补 0x80 + 0 填充 + 8 字节大端位长度，总长 64 的倍数
	const paddedLen = (((data.length + 8) >> 6) + 1) << 6
	const buf = new Uint8Array(paddedLen)
	buf.set(data)
	buf[data.length] = 0x80
	// 位长度按 64 位大端写入（实际消息远小于 2^32 位，高 4 字节恒 0）
	buf[paddedLen - 4] = (bitLen >>> 24) & 0xff
	buf[paddedLen - 3] = (bitLen >>> 16) & 0xff
	buf[paddedLen - 2] = (bitLen >>> 8) & 0xff
	buf[paddedLen - 1] = bitLen & 0xff

	const v = [...IV]
	for (let offset = 0; offset < paddedLen; offset += 64) {
		compress(v, buf, offset)
	}

	const out = new Uint8Array(32)
	for (let i = 0; i < 8; i++) {
		out[i * 4] = (v[i] >>> 24) & 0xff
		out[i * 4 + 1] = (v[i] >>> 16) & 0xff
		out[i * 4 + 2] = (v[i] >>> 8) & 0xff
		out[i * 4 + 3] = v[i] & 0xff
	}
	return out
}

const encoder = new TextEncoder()

/** SM3(UTF-8 字符串) */
export function sm3OfString(text: string): Uint8Array {
	return sm3(encoder.encode(text))
}
