/**
 * 抖音 web 端 a_bogus 签名 v2（bdms.js v1.0.1.19-fix.01，SDK 版本块 [1,0,1,0]）。
 * 移植自 Evil0ctal/Douyin_TikTok_Download_API 的 src/dtk/signing/native/abogus.py。
 *
 * 2026-10 抖音升级风控：旧版 SDK 1.0.1.5 变体（盐 "cus"）被 Argus 整体拒绝
 * （403 Uifid Not Found），且 detail 接口转为签保护，必须同时携带
 * x-secsdk-web-signature（见 webSign.ts）与 uifid 访客凭证。
 *
 * 与旧版的差异要点：
 * - 盐 "cus" → "dhzx"；SM3 双哈希不变，UA 链改为 单SM3(定制base64(s3, rc4(ua)))
 * - rc4 是变体：S 盒逆序初始化，密钥调度带乘法（教科书 RC4 爆破不出）
 * - 载荷结构全换：50 个标量字段按 FIELD_ORDER 固定排列 + 浏览器几何串 + 校验位，
 *   经噪声扩散（3 字节 → 4 载波字节）后用单字节密钥 0xD3 的变体 rc4 密封
 * - 噪声字节不是纯随机：头部第 2 噪声字节是浏览器家族上报（band 外 = 非浏览器），
 *   版本块低位带探针/绊线状态——全填均匀随机等于自报家门，须按真实分布生成
 */
import { sm3, sm3OfString } from './sm3'

/** s3 给 UA 密封体编码，s4 给最终签名编码 */
const ALPHABET_S3 = 'ckdp1h4ZKsUB80/Mfvw36XIgR25+WQAlEi7NLboqYTOPuzmFjJnryx9HVGDaStCe'
const ALPHABET_S4 = 'Dkdpgh2ZmsQB80/MfvV36XI1R45-WUAlEixNLwoqYTOPuzKFjJnry79HbGcaStCe'

const SALT = 'dhzx'
const HEADER_MAGIC: [number, number] = [3, 82]
const SDK_VERSION: [number, number] = [1, 0] // 两对都是 [1,0]，版本块解出 [1,0,1,0]
const PAYLOAD_KEY = 0xd3

/** 2024-07-24T16:00:00Z，L26 字段数从这一刻起的双周数 */
const FORTNIGHT_EPOCH_MS = 1_721_836_800_000
const FORTNIGHT_MS = 14 * 24 * 60 * 60 * 1000
const PAGE_ID = 6241
const AID = 6383

/** fn148 的噪声/数据掩码：0x91|0x42|0x2C == 0xFF，第四字节收齐前三字节让出的位 */
const NOISE_MASKS = [0x91, 0x42, 0x2c]
const DATA_MASKS = [0x6e, 0xbd, 0xd3]

/** 50 个标量字段进载荷的固定排列（字节码里的原序） */
const FIELD_ORDER = [
	34, 44, 56, 61, 73, 29, 70, 45, 35, 49, 38, 66, 51, 68, 28, 48, 64, 47, 30, 71, 26, 55, 31, 69,
	59, 40, 62, 63, 27, 72, 41, 74, 57, 52, 42, 39, 33, 67, 53, 43, 65, 46, 36, 24, 60, 32, 79, 80,
	84, 85,
]

/** 未插桩浏览器的自报：环境探针 / bot 检测位 / nr 标记 */
const ENV_FLAGS = 1
const DETECT_FLAGS = 14
const NR_FLAGS = 0x21
/** window.onwheelx._Ax 存在且冻结（健康态）；11/12 分别表示缺失/被解锁 */
const TRIPWIRE_LOCKED = 3
/** fn149 的按页签名计数桶：6 = 本页签名 <140 次，浏览器最常见的状态 */
const CALL_BUCKET = 6

/** Chrome + 1080p：屏幕 1920x1080，去任务栏 1032，再去浏览器栏 947。与请求参数里的 screen 保持一致 */
const DEFAULT_BROWSER_INFO = '1920|947|1920|1032|1920|1032|1920|1080|Win32'

/** 摘要哨兵链：(offset, sentinel, fallback)，写哨兵值等于上报环境探针异常，永远写诚实值 */
const CANARY_QUERY = [3, 11, 12] as const
const CANARY_BODY = [4, 8, 9] as const
const CANARY_UA = [5, 12, 13] as const

export interface ABogusOptions {
	/** 浏览器几何串，默认 1080p Chrome；须与请求参数 screen_width/height 自洽 */
	browserInfo?: string
	/** 请求体（POST 时参与哈希；GET 传空） */
	body?: string
	/** 测试用：固定时间戳（生产勿传） */
	nowMs?: number
	/** 测试用：固定随机源（生产勿传），调用顺序与 Python 版逐次对齐 */
	rand?: () => number
}

/** SDK 的 RC4 变体：S 盒逆序初始化，密钥调度 j = (j * box[i] + j + key) % 256 */
function sdkRc4(key: number[], data: number[]): number[] {
	const box = new Array<number>(256)
	for (let i = 0; i < 256; i++) box[255 - i] = i
	let j = 0
	for (let i = 0; i < 256; i++) {
		j = (j * box[i] + j + key[i % key.length]) % 256
		;[box[i], box[j]] = [box[j], box[i]]
	}
	let a = 0
	let b = 0
	return data.map((byte) => {
		a = (a + 1) % 256
		b = (b + box[a]) % 256
		;[box[a], box[b]] = [box[b], box[a]]
		return byte ^ box[(box[a] + box[b]) % 256]
	})
}

/** 定制 base64（指定码表），'=' 补齐 */
function encodeBase64(data: number[], alphabet: string): string {
	const out: string[] = []
	for (let i = 0; i < data.length; i += 3) {
		const chunk = data.slice(i, i + 3)
		let block = 0
		for (const byte of chunk) block = (block << 8) | byte
		block <<= 8 * (3 - chunk.length)
		const digits = [18, 12, 6, 0].map((shift) => (block >> shift) & 0x3f)
		for (const digit of digits.slice(0, chunk.length + 1)) out.push(alphabet[digit])
	}
	return out.join('') + '='.repeat((4 - (out.length % 4)) % 4)
}

/** JS 字符串 → SDK 字节流：按 UTF-16 码元走，>0xFF 的码元发两个大端字节（不是 UTF-8） */
function jsBytes(text: string): number[] {
	const out: number[] = []
	for (let i = 0; i < text.length; i++) {
		const code = text.charCodeAt(i)
		if (code & 0xff00) out.push(code >> 8)
		out.push(code & 0xff)
	}
	return out
}

const leBytes = (value: number, count: number): number[] =>
	Array.from({ length: count }, (_, i) => Math.floor(value / 2 ** (8 * i)) % 256)

/** SM3(SM3(text + 盐)) */
const digestOf = (text: string): number[] => [...sm3(sm3OfString(text + SALT))]

/** UA 链：rc4(UA) → s3 base64 → 单轮 SM3；密钥由环境探针值派生，同一身份恒定 */
function userAgentDigest(userAgent: string): number[] {
	const key = [Math.floor(ENV_FLAGS / 256) % 256, ENV_FLAGS % 256, DETECT_FLAGS % 256]
	const sealed = sdkRc4(key, jsBytes(userAgent.trim()))
	return [...sm3OfString(encodeBase64(sealed, ALPHABET_S3))]
}

/** 摘要里 offset 起第一个非哨兵字节；没有则写 fallback */
function canary(digest: number[], offset: number, sentinel: number, fallback: number): number {
	for (let i = offset; i < digest.length; i++) {
		if (digest[i] !== sentinel) return digest[i]
	}
	return fallback
}

/** fn143：浏览器家族上报伪装成噪声。带外的值没有浏览器能发出，均匀随机 6% 落进空隙 */
function headerNoise(userAgent: string, rand: () => number): number {
	const ua = userAgent.toLowerCase()
	const base = ua.includes('edg')
		? 125
		: ua.includes('huawei')
			? 170
			: ua.includes('firefox')
				? 40
				: ua.includes('chrome')
					? 0
					: ua.includes('safari')
						? 81
						: 210
	return (base + Math.floor(rand() * 40)) & 0xff
}

/** fn144：<110 直通，>=110 强制为奇数（110..240 一半不可达） */
const probeNoise = (rand: () => number): number => {
	const value = Math.floor(rand() * 240)
	return value > 109 ? value + (value % 2) + 1 : value
}

/** fn145：「我的绊线都在且已冻结」+ 真噪声；均匀随机 94% 会报成被剥壳 */
const tripwireNoise = (rand: () => number): number => (Math.floor(rand() * 255) & 0x4d) | 0xb2

/** 两字节摊进四载波字节：0xAA/0x55 交替掩码，另一半填噪声（low/high 可注入环境上报） */
function maskPair(
	pair: readonly [number, number],
	rand: () => number,
	low?: number,
	high?: number,
): number[] {
	const noise = Math.floor(rand() * 65535)
	const lo = (low ?? noise) & 0xff
	const hi = (high ?? noise >> 8) & 0xff
	return [
		(lo & 0xaa) | (pair[0] & 0x55),
		(lo & 0x55) | (pair[0] & 0xaa),
		(hi & 0xaa) | (pair[1] & 0x55),
		(hi & 0x55) | (pair[1] & 0xaa),
	]
}

/** 3 载荷字节 + 1 噪声字节 → 4 载波字节；不足 3 字节的尾组按 SDK 原样透传（0 值第二字节会被丢弃） */
function expandNoise(body: number[], rand: () => number): number[] {
	const out: number[] = []
	for (let i = 0; i < body.length; i += 3) {
		const group = body.slice(i, i + 3)
		if (group.length < 3) {
			out.push(group[0])
			if (group.length > 1 && group[1]) out.push(group[1])
			continue
		}
		const noise = Math.floor(rand() * 1000) & 0xff
		for (let k = 0; k < 3; k++) out.push((noise & NOISE_MASKS[k]) | (group[k] & DATA_MASKS[k]))
		out.push(
			(group[0] & NOISE_MASKS[0]) | (group[1] & NOISE_MASKS[1]) | (group[2] & NOISE_MASKS[2]),
		)
	}
	return out
}

/**
 * 生成 a_bogus。query 必须与实际请求的 query string 逐字节一致（字段顺序、编码都要相同），
 * userAgent 必须与请求头 UA 一致。body 仅 POST 时传。
 */
export function generateABogus(
	query: string,
	userAgent: string,
	options: ABogusOptions = {},
): string {
	const rand = options.rand ?? Math.random
	const browserInfo = options.browserInfo ?? DEFAULT_BROWSER_INFO
	const now = options.nowMs ?? Date.now()

	const ink = now - 1 // SDK 上一调用点种在 navigator 原型上的 Date.now()-1，活性自检
	const fortnights = Math.floor((now - FORTNIGHT_EPOCH_MS) / FORTNIGHT_MS)
	const infoBytes = jsBytes(browserInfo)
	const tailBytes = jsBytes(`${(now + 3) & 0xff},`)

	// 50 个标量字段（下标即 L 编号）
	const fields = new Array<number>(86).fill(0)
	fields[24] = 41
	fields[26] = fortnights
	fields[27] = CALL_BUCKET
	fields[28] = 3 // SDK 初始化至今毫秒数 +3：刚加载的页是小数字
	leBytes(now, 6).forEach((byte, i) => {
		fields[29 + i] = byte
	})
	fields[35] = ENV_FLAGS & 0xff
	fields[36] = Math.floor(ENV_FLAGS / 256) & 0xff
	fields[38] = NR_FLAGS & 0xff
	fields[39] = (NR_FLAGS >> 8) & 0xff
	;[0, 0, 0, 0].forEach((byte, i) => {
		fields[40 + i] = byte
	})
	leBytes(DETECT_FLAGS, 4).forEach((byte, i) => {
		fields[44 + i] = byte
	})
	leBytes(ink, 6).forEach((byte, i) => {
		fields[60 + i] = byte
	})
	fields[66] = TRIPWIRE_LOCKED
	leBytes(PAGE_ID, 4).forEach((byte, i) => {
		fields[67 + i] = byte
	})
	leBytes(AID, 4).forEach((byte, i) => {
		fields[71 + i] = byte
	})
	fields[79] = infoBytes.length & 0xff
	fields[80] = (infoBytes.length >> 8) & 0xff
	fields[84] = tailBytes.length & 0xff
	fields[85] = (tailBytes.length >> 8) & 0xff

	// 三条摘要链：query / body / UA，各落三个字节（两直接位 + 一哨兵位）
	const queryDigest = digestOf(query)
	const bodyDigest = digestOf(options.body ?? '')
	const uaDigest = userAgentDigest(userAgent)
	fields[48] = queryDigest[9]
	fields[49] = queryDigest[18]
	fields[51] = canary(queryDigest, ...CANARY_QUERY)
	fields[52] = bodyDigest[10]
	fields[53] = bodyDigest[19]
	fields[55] = canary(bodyDigest, ...CANARY_BODY)
	fields[56] = uaDigest[11]
	fields[57] = uaDigest[21]
	fields[59] = canary(uaDigest, ...CANARY_UA)

	// 版本块：第二对的两个噪声字节是探针/绊线上报（先求值，与 Python 参数求值顺序一致）
	const version = [
		...maskPair(SDK_VERSION, rand),
		...maskPair(SDK_VERSION, rand, probeNoise(rand), tripwireNoise(rand)),
	]

	// 校验位只覆盖版本块 + 50 标量，不含几何串与尾串
	let checksum = 0
	for (const byte of version) checksum ^= byte
	for (const index of FIELD_ORDER) checksum ^= fields[index]

	const bodyBytes = [
		...FIELD_ORDER.map((index) => fields[index]),
		...infoBytes,
		...tailBytes,
		checksum,
	]
	const header = maskPair(HEADER_MAGIC, rand, undefined, headerNoise(userAgent, rand))
	const frame = expandNoise(bodyBytes, rand)
	const sealed = sdkRc4([PAYLOAD_KEY], [...version, ...frame])
	return encodeBase64([...header, ...sealed], ALPHABET_S4)
}
