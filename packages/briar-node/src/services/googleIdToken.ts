import { type KeyObject, createPublicKey } from 'crypto'
import fs from 'fs'
import path from 'path'
import jwt from 'jsonwebtoken'
import { AUTH_CONFIG } from '../config/auth'
import { fetchViaProxy } from '../lib/outboundProxy'

/**
 * Google Identity Services（GIS）ID Token 本地验签。
 *
 * 服务器在国内连不上 Google：浏览器侧拿到 Google 签名的 ID Token（JWT），
 * 后端只用 Google 公钥（JWKS）本地校验 RS256 签名，不再调 Google 接口换 token。
 *
 * 公钥来源（按优先级合并，kid 维度去重）：
 *  1. 启动时 + 每天尝试拉 https://www.googleapis.com/oauth2/v3/certs（可配 BRIAR_GOOGLE_PROXY 代理）；
 *     拉到后顺手写回本地文件
 *  2. 本地文件 BRIAR_GOOGLE_JWKS_FILE（默认 <cwd>/data/google-jwks.json，
 *     pm2 cwd = packages/briar-node）；GitHub Actions 部署时由 runner 拉取后写入
 */

export const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs'
const GOOGLE_ISSUERS: [string, ...string[]] = ['accounts.google.com', 'https://accounts.google.com']
/** 每日刷新（CI 的 Refresh Google JWKS 工作流每 12 小时写一次本地文件） */
const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000
/** 遇到未知 kid 时触发重新加载的最小间隔，避免被恶意 token 刷爆 */
const UNKNOWN_KID_RELOAD_INTERVAL_MS = 5 * 60 * 1000
const FETCH_TIMEOUT_MS = 8000

interface Jwk {
	kid: string
	kty: string
	alg?: string
	n: string
	e: string
	use?: string
}

interface Jwks {
	keys: Jwk[]
}

export interface GoogleIdTokenClaims {
	sub: string
	email: string
	email_verified: boolean | string
	name?: string
	picture?: string
	iss: string
	aud: string
	exp: number
}

const keys = new Map<string, KeyObject>()
let lastSource: 'none' | 'file' | 'network' = 'none'
let lastLoadedAt = 0
let lastUnknownKidReload = 0
let refreshTimer: NodeJS.Timeout | null = null

const jwksFilePath = () =>
	process.env.BRIAR_GOOGLE_JWKS_FILE?.trim() || path.resolve(process.cwd(), 'data/google-jwks.json')

const proxyUri = () =>
	process.env.BRIAR_GOOGLE_PROXY?.trim() || process.env.BRIAR_MEDIA_OUTBOUND_PROXY?.trim() || ''

const isJwks = (value: unknown): value is Jwks =>
	Boolean(
		value &&
			typeof value === 'object' &&
			Array.isArray((value as Jwks).keys) &&
			(value as Jwks).keys.every(
				(k) => k && typeof k.kid === 'string' && typeof k.n === 'string' && typeof k.e === 'string',
			),
	)

/** 用一份 JWKS 替换内存公钥表（只收 RSA 公钥） */
export const applyJwks = (jwks: Jwks, source: 'file' | 'network') => {
	const next = new Map<string, KeyObject>()
	for (const k of jwks.keys) {
		if (k.kty !== 'RSA') continue
		try {
			next.set(k.kid, createPublicKey({ key: { kty: 'RSA', n: k.n, e: k.e }, format: 'jwk' }))
		} catch (err) {
			console.warn('[google-jwks] 跳过无效公钥', k.kid, err)
		}
	}
	if (next.size === 0) return false
	keys.clear()
	for (const [kid, key] of next) keys.set(kid, key)
	lastSource = source
	lastLoadedAt = Date.now()
	return true
}

const loadFromFile = () => {
	const file = jwksFilePath()
	try {
		if (!fs.existsSync(file)) return false
		const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'))
		if (!isJwks(parsed)) {
			console.warn('[google-jwks] 本地文件格式不对：', file)
			return false
		}
		return applyJwks(parsed, 'file')
	} catch (err) {
		console.warn('[google-jwks] 读取本地文件失败：', file, err)
		return false
	}
}

const loadFromNetwork = async () => {
	try {
		const res = await fetchViaProxy(proxyUri(), GOOGLE_JWKS_URL, {
			signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
		})
		if (!res.ok) {
			console.warn('[google-jwks] 拉取失败 HTTP', res.status)
			return false
		}
		const json = (await res.json()) as unknown
		if (!isJwks(json) || !applyJwks(json, 'network')) return false
		// 写回本地文件，后续重启 / 断网时可用
		try {
			const file = jwksFilePath()
			fs.mkdirSync(path.dirname(file), { recursive: true })
			fs.writeFileSync(file, JSON.stringify(json))
		} catch (err) {
			console.warn('[google-jwks] 写本地文件失败（忽略）', err)
		}
		return true
	} catch (err) {
		console.warn(
			'[google-jwks] 无法连接 Google（国内服务器常见，使用本地文件）：',
			err instanceof Error ? err.message : err,
		)
		return false
	}
}

/** 先读本地文件（秒级可用），再尝试联网刷新 */
export const refreshGoogleJwks = async () => {
	const fromFile = loadFromFile()
	const fromNet = await loadFromNetwork()
	if (!fromFile && !fromNet) {
		console.warn(`[google-jwks] 没有可用公钥：Google 登录将失败（文件 ${jwksFilePath()}）`)
	} else {
		console.log(`[google-jwks] 公钥就绪 ${keys.size} 个，来源 ${lastSource}`)
	}
	return keys.size > 0
}

/** 启动时调用：立即加载 + 每日刷新 */
export const initGoogleJwks = () => {
	void refreshGoogleJwks()
	if (!refreshTimer) {
		refreshTimer = setInterval(() => void refreshGoogleJwks(), REFRESH_INTERVAL_MS)
		refreshTimer.unref?.()
	}
}

export const getGoogleJwksStatus = () => ({
	keyCount: keys.size,
	kids: [...keys.keys()],
	source: lastSource,
	loadedAt: lastLoadedAt ? new Date(lastLoadedAt).toISOString() : null,
	file: jwksFilePath(),
})

const getKeyForKid = async (kid: string) => {
	const hit = keys.get(kid)
	if (hit) return hit
	// Google 轮换公钥后可能出现新 kid：限频重新加载（文件可能已被 CI 更新）
	if (Date.now() - lastUnknownKidReload > UNKNOWN_KID_RELOAD_INTERVAL_MS) {
		lastUnknownKidReload = Date.now()
		await refreshGoogleJwks()
	}
	return keys.get(kid) ?? null
}

/**
 * 校验 GIS 返回的 credential（ID Token）：RS256 签名、iss、aud、exp、email_verified。
 * 失败抛 Error(code)。
 */
export const verifyGoogleIdToken = async (idToken: string): Promise<GoogleIdTokenClaims> => {
	if (!AUTH_CONFIG.googleClientId) throw new Error('GOOGLE_NOT_CONFIGURED')

	const decoded = jwt.decode(idToken, { complete: true })
	if (!decoded || typeof decoded === 'string' || decoded.header.alg !== 'RS256') {
		throw new Error('GOOGLE_ID_TOKEN_INVALID')
	}
	const kid = decoded.header.kid
	if (!kid) throw new Error('GOOGLE_ID_TOKEN_INVALID')

	const key = await getKeyForKid(kid)
	if (!key) {
		console.error('[google-jwks] 未找到 kid 对应公钥：', kid, getGoogleJwksStatus())
		throw new Error('GOOGLE_JWKS_UNAVAILABLE')
	}

	let claims: GoogleIdTokenClaims
	try {
		claims = jwt.verify(idToken, key, {
			algorithms: ['RS256'],
			audience: AUTH_CONFIG.googleClientId,
			issuer: GOOGLE_ISSUERS,
			clockTolerance: 30,
		}) as GoogleIdTokenClaims
	} catch (err) {
		console.warn('[google] ID Token 校验失败：', err instanceof Error ? err.message : err)
		throw new Error(
			err instanceof jwt.TokenExpiredError ? 'GOOGLE_ID_TOKEN_EXPIRED' : 'GOOGLE_ID_TOKEN_INVALID',
		)
	}

	if (!claims.sub || !claims.email) throw new Error('GOOGLE_PROFILE_INCOMPLETE')
	if (!(claims.email_verified === true || claims.email_verified === 'true')) {
		throw new Error('GOOGLE_EMAIL_UNVERIFIED')
	}
	return claims
}
