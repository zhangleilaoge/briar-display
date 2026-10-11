/**
 * 抖音 x-secsdk-web-signature（webSignUrl），移植自上游 websign.py
 * （@byted/secsdk-strategy v1.0.40，project-id=34，盐是 VM 字符串表 #39）。
 *
 * 抖音对 detail 等接口开了签保护：缺 uifid/x-secsdk-web-signature 一律
 * 403 ArgusSecurityPlugin。签名是纯函数：md5(`${uifid}_${timestamp}_${盐}_${整段query}`)，
 * 覆盖签名前的全部参数（含 a_bogus），编码必须与线上 URLSearchParams.toString() 一致。
 */
import { createHash } from 'node:crypto'

const WEBSIGN_SALT = 'A96D855A08C0A9707F8BEF0D9A527E4E'

export const UIFID_HEADER = 'uifid'
export const SIGNATURE_HEADER = 'x-secsdk-web-signature'
export const EXPIRE_HEADER = 'x-secsdk-web-expire'

/** URLSearchParams 语义的百分号编码：保留 *-._（Python quote(safe='*-._') 等价物） */
const quote = (value: string): string =>
	encodeURIComponent(value).replace(
		/[!'()~]/g,
		(c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
	)

/**
 * 追加访客参数并对整段 query 签名。
 * pairs 为签名前的全部参数（原始值，顺序即线上顺序）；uifid/timestamp 在这里追加。
 * 返回最终 query string、签名值和须随请求携带的三个头。
 */
export function webSign(
	pairs: [string, string][],
	uifid: string,
	timestampSec = Math.floor(Date.now() / 1000),
): { query: string; signature: string; headers: Record<string, string> } {
	const covered: [string, string][] = pairs.some(([name]) => name === UIFID_HEADER)
		? [...pairs]
		: [...pairs, [UIFID_HEADER, uifid]]
	covered.push(['timestamp', String(timestampSec)])
	const query = covered.map(([k, v]) => `${quote(k)}=${quote(v)}`).join('&')
	const signature = createHash('md5')
		.update(`${uifid}_${timestampSec}_${WEBSIGN_SALT}_${query}`)
		.digest('hex')
	return {
		query: `${query}&${SIGNATURE_HEADER}=${signature}`,
		signature,
		headers: {
			[UIFID_HEADER]: uifid,
			[SIGNATURE_HEADER]: signature,
			[EXPIRE_HEADER]: String(timestampSec),
		},
	}
}

const MS_TOKEN_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-'

/** 本地伪造 msToken（126 位 + "=="）；实测 detail 接口不校验真伪，伪造/缺失/矛盾均放行 */
export const genMsToken = (): string =>
	`${Array.from(
		{ length: 126 },
		() => MS_TOKEN_ALPHABET[Math.floor(Math.random() * MS_TOKEN_ALPHABET.length)],
	).join('')}==`

const VERIFY_FP_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

/** 伪造 s_v_web_id（verifyFp/fp）：verify_<base36毫秒>_<36位 UUID v4 骨架（下划线分隔）> */
export function genVerifyFp(nowMs = Date.now()): string {
	const tail = new Array<string>(36)
	for (const index of [8, 13, 18, 23]) tail[index] = '_'
	tail[14] = '4'
	for (let i = 0; i < 36; i++) {
		if (tail[i]) continue
		let position = Math.floor(Math.random() * VERIFY_FP_ALPHABET.length)
		if (i === 19) position = (3 & position) | 8
		tail[i] = VERIFY_FP_ALPHABET[position]
	}
	return `verify_${nowMs.toString(36)}_${tail.join('')}`
}
