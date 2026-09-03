/**
 * 抖音 web 端 a_bogus 签名（纯 TS 移植）
 * 算法参考 Evil0ctal/Douyin_TikTok_Download_API 的 abogus.py（SDK 1.0.1.5 变体，盐 "cus"），
 * 已验证可通过 www.douyin.com/aweme/v1/web/* 接口的服务端校验。
 *
 * 注意：
 * - 本实现固定 ua_code，对应固定 UA（A_BOGUS_UA），改 UA 必须同步重算 ua_code
 * - 字节用 number 表示（rc4 异或后可能 >255，与 Python chr/ord 语义一致），不要截断成 0-255
 */
import { sm3, sm3OfString } from './sm3'

/** 与 UA_CODE 绑定的 UA（改 UA 需用同算法重算 UA_CODE） */
export const A_BOGUS_UA =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36'

/** UA 经 rc4+定制 base64 后的字节码（对应上面的固定 UA） */
const UA_CODE = [
	76, 98, 15, 131, 97, 245, 224, 133, 122, 199, 241, 166, 79, 34, 90, 191, 128, 126, 122, 98, 66,
	11, 14, 40, 49, 110, 110, 173, 67, 96, 138, 252,
]

/** 固定浏览器环境串（签名只要求自洽，服务端不校验真实性） */
const BROWSER_INFO = '1536|742|1536|864|0|0|0|0|1536|864|1536|864|1536|742|24|24|MacIntel'
const BROWSER_CODE = [...BROWSER_INFO].map((c) => c.charCodeAt(0))

const BASE64_S4 = 'Dkdpgh2ZmsQB80/MfvV36XI1R45-WUAlEixNLwoqYTOPuzKFjJnry79HbGcaStCe'

const SALT = 'cus'

/** sm3(sm3(text + 盐)) → 32 字节数组 */
const doubleSm3 = (text: string): number[] => [...sm3(sm3OfString(text + SALT))]

/** "GET" + 盐的两轮 sm3（常量，模块加载时算一次） */
const METHOD_CODE = doubleSm3('GET')

/** 由随机数 r 生成 4 字节组（对应 Python random_list，d/e/f/g 为各字节的固定位） */
function randomListFrom(r: number, d: number, e: number, f: number, g: number): number[] {
	const v1 = Math.floor(r) & 255
	const v2 = Math.floor(r) >> 8
	return [(v1 & 170) | d, (v1 & 85) | e, (v2 & 170) | f, (v2 & 85) | g]
}

/** 标准 RC4（key="y"），输入输出均为 number 数组（输出元素可能 >255，勿截断） */
function rc4Encrypt(data: number[], key: string): number[] {
	const s = Array.from({ length: 256 }, (_, i) => i)
	let j = 0
	for (let i = 0; i < 256; i++) {
		j = (j + s[i] + key.charCodeAt(i % key.length)) % 256
		;[s[i], s[j]] = [s[j], s[i]]
	}
	let i = 0
	j = 0
	return data.map((byte) => {
		i = (i + 1) % 256
		j = (j + s[i]) % 256
		;[s[i], s[j]] = [s[j], s[i]]
		return s[(s[i] + s[j]) % 256] ^ byte
	})
}

/** 定制 base64（s4 码表），与 Python 版逐字节对齐 */
function customBase64(data: number[]): string {
	const out: string[] = []
	for (let i = 0; i < data.length; i += 3) {
		let n: number
		if (i + 2 < data.length) {
			n = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2]
		} else if (i + 1 < data.length) {
			n = (data[i] << 16) | (data[i + 1] << 8)
		} else {
			n = data[i] << 16
		}
		for (const [shift, mask] of [
			[18, 0xfc0000],
			[12, 0x03f000],
			[6, 0x0fc0],
			[0, 0x3f],
		] as const) {
			if (shift === 6 && i + 1 >= data.length) break
			if (shift === 0 && i + 2 >= data.length) break
			out.push(BASE64_S4[(n & mask) >> shift])
		}
	}
	const pad = (4 - (out.length % 4)) % 4
	return out.join('') + '='.repeat(pad)
}

export interface ABogusOptions {
	/** 测试用：固定时间戳与随机源（生产勿传） */
	startTime?: number
	endTime?: number
	randoms?: [number, number, number]
}

/**
 * 生成 a_bogus。query 必须与实际请求的 query string 逐字节一致（字段顺序、编码都要相同）。
 */
export function generateABogus(query: string, options: ABogusOptions = {}): string {
	const startTime = options.startTime ?? Date.now()
	const endTime = options.endTime ?? startTime + 4 + Math.floor(Math.random() * 5)

	// string_1：12 字节随机头（list_1/list_2/list_3 三个变体）
	const [r1, r2, r3] = options.randoms ?? [
		Math.random() * 10000,
		Math.random() * 10000,
		Math.random() * 10000,
	]
	const string1 = [
		...randomListFrom(r1, 1, 2, 5, 40),
		...randomListFrom(r2, 1, 0, 0, 0),
		...randomListFrom(r3, 1, 0, 5, 0),
	]

	// string_2：44 字节模板 + 环境串 + 校验位，再 RC4
	const paramsCode = doubleSm3(query)
	const byte = (v: number, shift: number) => Math.floor(v / 2 ** shift) & 255
	const list = [
		44,
		byte(endTime, 24),
		0,
		0,
		0,
		0,
		24,
		paramsCode[21],
		METHOD_CODE[21],
		0,
		UA_CODE[23],
		byte(endTime, 16),
		0,
		0,
		0,
		1,
		0,
		239,
		paramsCode[22],
		METHOD_CODE[22],
		UA_CODE[24],
		byte(endTime, 8),
		0,
		0,
		0,
		0,
		endTime & 255,
		0,
		0,
		14,
		byte(startTime, 24),
		byte(startTime, 16),
		0,
		byte(startTime, 8),
		startTime & 255,
		3,
		Math.floor(endTime / 2 ** 32),
		1,
		Math.floor(startTime / 2 ** 32),
		1,
		BROWSER_CODE.length,
		0,
		0,
		0,
	]
	const checkNum = list.reduce((acc, v) => acc ^ v, 0)
	const string2 = rc4Encrypt([...list, ...BROWSER_CODE, checkNum], 'y')

	return customBase64([...string1, ...string2])
}
