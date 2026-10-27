import { describe, expect, it } from 'bun:test'
import { validateMerge } from '../userMergeService'
import { pickMergeFolderName, pickSettingsFill, relocateKey } from './handlers'
import type { MergeUserRow } from './types'

const user = (over: Partial<MergeUserRow>): MergeUserRow => ({
	id: 'u',
	name: 'n',
	email: 'e',
	avatar: null,
	passwordHash: 'h',
	hasPassword: true,
	securityPasswordHash: null,
	...over,
})

describe('validateMerge', () => {
	it('拒绝合并到自己、合并掉当前管理员、缺目标', () => {
		expect(validateMerge({ sourceId: 'a', targetId: 'a', currentUserId: 'x' })).toBe(
			'MERGE_SAME_USER',
		)
		expect(validateMerge({ sourceId: 'x', targetId: 'b', currentUserId: 'x' })).toBe(
			'MERGE_SELF_SOURCE',
		)
		expect(validateMerge({ sourceId: 'a', targetId: '', currentUserId: 'x' })).toBe(
			'MERGE_MISSING_TARGET',
		)
		expect(validateMerge({ sourceId: 'a', targetId: 'b', currentUserId: 'x' })).toBeNull()
	})
})

describe('pickMergeFolderName', () => {
	it('无重名直接用「合并自 <B>」，重名追加序号', () => {
		expect(pickMergeFolderName('张磊', [])).toBe('合并自 张磊')
		expect(pickMergeFolderName('张磊', ['合并自 张磊'])).toBe('合并自 张磊 (2)')
		expect(pickMergeFolderName('张磊', ['合并自 张磊', '合并自 张磊 (2)'])).toBe('合并自 张磊 (3)')
	})
})

describe('relocateKey', () => {
	it('只改写 files/{源用户}/ 前缀', () => {
		expect(relocateKey('files/a/x.png', 'a', 'b')).toBe('files/b/x.png')
		expect(relocateKey('files/c/x.png', 'a', 'b')).toBeNull()
		expect(relocateKey('other/a/x.png', 'a', 'b')).toBeNull()
	})
})

describe('pickSettingsFill（目标优先）', () => {
	it('目标已有值时不覆盖', () => {
		const fill = pickSettingsFill({
			source: user({ avatar: 's.png', securityPasswordHash: 's' }),
			target: user({ avatar: 't.png', securityPasswordHash: 't' }),
		})
		expect(fill).toEqual({})
	})
	it('目标为空时沿用源用户', () => {
		const fill = pickSettingsFill({
			source: user({ avatar: 's.png', securityPasswordHash: 's', passwordHash: 'sp' }),
			target: user({ hasPassword: false }),
		})
		expect(fill).toEqual({ avatar: 's.png', securityPasswordHash: 's', passwordHash: 'sp' })
	})
	it('源用户没有密码时不补登录密码', () => {
		expect(
			pickSettingsFill({
				source: user({ hasPassword: false }),
				target: user({ hasPassword: false }),
			}),
		).toEqual({})
	})
})
