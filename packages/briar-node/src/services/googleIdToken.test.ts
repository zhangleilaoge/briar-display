import { describe, expect, test } from 'bun:test'
import { generateKeyPairSync } from 'crypto'
import jwt from 'jsonwebtoken'
import { AUTH_CONFIG } from '../config/auth'
import { applyJwks, verifyGoogleIdToken } from './googleIdToken'

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const jwk = publicKey.export({ format: 'jwk' }) as { n: string; e: string }
const KID = 'test-kid'
applyJwks({ keys: [{ kid: KID, kty: 'RSA', alg: 'RS256', n: jwk.n, e: jwk.e }] }, 'file')

const sign = (claims: Record<string, unknown>, opts: jwt.SignOptions = {}) =>
	jwt.sign(
		{
			sub: '1234567890',
			email: 'User@Example.com',
			email_verified: true,
			name: 'Test User',
			...claims,
		},
		privateKey,
		{
			algorithm: 'RS256',
			keyid: KID,
			issuer: 'https://accounts.google.com',
			audience: AUTH_CONFIG.googleClientId,
			expiresIn: '1h',
			...opts,
		},
	)

describe('verifyGoogleIdToken', () => {
	test('合法 token 通过', async () => {
		const claims = await verifyGoogleIdToken(sign({}))
		expect(claims.sub).toBe('1234567890')
	})

	test('iss 不带 https 也接受', async () => {
		const claims = await verifyGoogleIdToken(sign({}, { issuer: 'accounts.google.com' }))
		expect(claims.email).toBe('User@Example.com')
	})

	test('aud 不匹配拒绝', async () => {
		await expect(verifyGoogleIdToken(sign({}, { audience: 'other-client' }))).rejects.toThrow(
			'GOOGLE_ID_TOKEN_INVALID',
		)
	})

	test('iss 不匹配拒绝', async () => {
		await expect(verifyGoogleIdToken(sign({}, { issuer: 'https://evil.example' }))).rejects.toThrow(
			'GOOGLE_ID_TOKEN_INVALID',
		)
	})

	test('过期拒绝', async () => {
		const expired = sign({ iat: Math.floor(Date.now() / 1000) - 7200 }, { expiresIn: '1h' })
		await expect(verifyGoogleIdToken(expired)).rejects.toThrow('GOOGLE_ID_TOKEN_EXPIRED')
	})

	test('邮箱未验证拒绝', async () => {
		await expect(verifyGoogleIdToken(sign({ email_verified: false }))).rejects.toThrow(
			'GOOGLE_EMAIL_UNVERIFIED',
		)
	})

	test('其他私钥签名拒绝', async () => {
		const other = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey
		const forged = jwt.sign({ sub: 'x', email: 'a@b.c', email_verified: true }, other, {
			algorithm: 'RS256',
			keyid: KID,
			issuer: 'https://accounts.google.com',
			audience: AUTH_CONFIG.googleClientId,
			expiresIn: '1h',
		})
		await expect(verifyGoogleIdToken(forged)).rejects.toThrow('GOOGLE_ID_TOKEN_INVALID')
	})

	test('HS256 token 拒绝', async () => {
		const hs = jwt.sign({ sub: 'x' }, 'secret', { algorithm: 'HS256', keyid: KID })
		await expect(verifyGoogleIdToken(hs)).rejects.toThrow('GOOGLE_ID_TOKEN_INVALID')
	})
})
