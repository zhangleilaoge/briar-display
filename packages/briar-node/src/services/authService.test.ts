import { describe, expect, test } from 'bun:test'
import type { UserRecord } from '../dal/userDal'
import { type AuthPayload, authService } from './authService'

const fakeUser = (overrides: Partial<UserRecord> = {}): UserRecord => ({
	id: 'user-1',
	name: '张三',
	email: 'zhangsan@example.com',
	avatar: null,
	passwordHash: 'hash',
	securityPasswordHash: null,
	tokenVersion: 3,
	createdAt: new Date(),
	...overrides,
})

// 纯逻辑测试：不碰数据库（verifyLoginToken 的 DB 校验走本地起服务 curl 验证）
describe('authService token 逻辑', () => {
	test('createToken/verifyToken 往返保留 token_version', () => {
		const token = authService.createToken(fakeUser())
		const payload = authService.verifyToken(token)
		expect(payload.sub).toBe('user-1')
		expect(payload.tv).toBe(3)
		expect(typeof payload.iat).toBe('number')
		expect(typeof payload.exp).toBe('number')
	})

	test('tokenVersion 缺省按 0 处理（兼容改动前的旧库记录）', () => {
		const user = fakeUser({ tokenVersion: undefined as unknown as number })
		const payload = authService.verifyToken(authService.createToken(user))
		expect(payload.tv).toBe(0)
	})

	describe('maybeRefreshLoginToken（滑动续期：剩余有效期不足一半时签新 token）', () => {
		const nowSec = Math.floor(Date.now() / 1000)
		const DAY = 86400

		test('剩余有效期过半：不续期', () => {
			const payload: AuthPayload = {
				sub: 'user-1',
				email: '',
				name: '',
				iat: nowSec - DAY,
				exp: nowSec + 6 * DAY,
			}
			expect(authService.maybeRefreshLoginToken(payload, fakeUser())).toBeNull()
		})

		test('剩余不足一半：签发新 token（携带当前 tokenVersion）', () => {
			const payload: AuthPayload = {
				sub: 'user-1',
				email: '',
				name: '',
				iat: nowSec - 6 * DAY,
				exp: nowSec + DAY,
			}
			const refreshed = authService.maybeRefreshLoginToken(payload, fakeUser())
			expect(refreshed).toBeTruthy()
			const next = authService.verifyToken(refreshed as string)
			expect(next.sub).toBe('user-1')
			expect(next.tv).toBe(3)
		})

		test('缺 iat/exp（旧格式或非标准 token）：不续期', () => {
			const payload: AuthPayload = { sub: 'user-1', email: '', name: '' }
			expect(authService.maybeRefreshLoginToken(payload, fakeUser())).toBeNull()
		})
	})
})
