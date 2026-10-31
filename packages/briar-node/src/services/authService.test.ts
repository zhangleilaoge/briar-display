import { describe, expect, test } from 'bun:test'
import type { UserRecord } from '../dal/userDal'
import {
	type AuthPayload,
	authService,
	canUnbindIdentity,
	decideGoogleLogin,
	sanitizeLoginRedirect,
} from './authService'

const fakeUser = (overrides: Partial<UserRecord> = {}): UserRecord => ({
	id: 'user-1',
	name: '张三',
	email: 'zhangsan@example.com',
	avatar: null,
	passwordHash: 'hash',
	securityPasswordHash: null,
	hasPassword: true,
	tokenVersion: 3,
	disabledAt: null,
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

describe('登录回跳', () => {
	test('sanitizeLoginRedirect 只放行站内相对路径', () => {
		expect(sanitizeLoginRedirect('/briar/tools')).toBe('/briar/tools')
		expect(sanitizeLoginRedirect('https://evil.example/')).toBe('/briar/')
		expect(sanitizeLoginRedirect('//evil.example')).toBe('/briar/')
		expect(sanitizeLoginRedirect(undefined)).toBe('/briar/')
	})
})

describe('Google 登录落点（decideGoogleLogin）', () => {
	test('已绑定 sub → 登录绑定的用户（即使邮箱属于另一个账号）', () => {
		expect(
			decideGoogleLogin({ identityUserId: 'u-qq', emailUserId: 'u-gmail', emailVerified: true }),
		).toEqual({ action: 'login', userId: 'u-qq' })
	})
	test('未绑定 + 邮箱已验证 + 同邮箱用户 → 自动关联', () => {
		expect(
			decideGoogleLogin({ identityUserId: null, emailUserId: 'u-1', emailVerified: true }),
		).toEqual({ action: 'link', userId: 'u-1' })
	})
	test('未绑定 + 邮箱未验证 + 同邮箱用户 → 冲突', () => {
		expect(
			decideGoogleLogin({ identityUserId: null, emailUserId: 'u-1', emailVerified: false }),
		).toEqual({ action: 'conflict' })
	})
	test('无匹配 → 新建', () => {
		expect(
			decideGoogleLogin({ identityUserId: null, emailUserId: null, emailVerified: true }),
		).toEqual({ action: 'create' })
	})
})

describe('解绑前提（canUnbindIdentity）', () => {
	test('有密码可解绑', () => {
		expect(canUnbindIdentity({ hasPassword: true, otherIdentityCount: 0 })).toBe(true)
	})
	test('无密码但有其它身份可解绑', () => {
		expect(canUnbindIdentity({ hasPassword: false, otherIdentityCount: 1 })).toBe(true)
	})
	test('唯一登录方式不可解绑', () => {
		expect(canUnbindIdentity({ hasPassword: false, otherIdentityCount: 0 })).toBe(false)
	})
})
