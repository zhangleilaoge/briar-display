import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

/** 用 JWT 密钥派生站点密钥箱主密钥，避免再引入独立 env */
function keyMaterial(): Buffer {
	const secret = process.env.BRIAR_JWT_SECRET || 'briar_dev_secret'
	return createHash('sha256').update(`briar-site-secret:${secret}`).digest()
}

/** AES-256-GCM；格式 v1:<base64(iv12|tag16|ciphertext)> */
export function sealSecret(plaintext: string): string {
	const iv = randomBytes(12)
	const cipher = createCipheriv('aes-256-gcm', keyMaterial(), iv)
	const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
	const tag = cipher.getAuthTag()
	return `v1:${Buffer.concat([iv, tag, enc]).toString('base64')}`
}

export function openSecret(sealed: string): string {
	if (!sealed.startsWith('v1:')) throw new Error('unsupported secret encoding')
	const buf = Buffer.from(sealed.slice(3), 'base64')
	if (buf.length < 28) throw new Error('corrupt secret')
	const iv = buf.subarray(0, 12)
	const tag = buf.subarray(12, 28)
	const data = buf.subarray(28)
	const decipher = createDecipheriv('aes-256-gcm', keyMaterial(), iv)
	decipher.setAuthTag(tag)
	return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}

/** 脱敏：只留末 4 位，永不回传全文 */
export function maskSecretHint(raw: string): string {
	const t = raw.trim()
	if (!t) return ''
	if (t.length <= 4) return '****'
	return `****${t.slice(-4)}`
}
