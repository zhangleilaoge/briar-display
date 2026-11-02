import { describe, expect, test } from 'bun:test'
import {
	moveRibbonItem,
	normalizeRibbonOrder,
	ribbonDragOffset,
	ribbonInsertionIndex,
} from './ribbonPreferences'

const available = ['home', 'style', 'tools', 'files'] as const

describe('左侧标签偏好', () => {
	test('过滤未知值与重复项，并保留已保存的顺序', () => {
		expect(normalizeRibbonOrder(['files', 'files', 'unknown', 'home'], available)).toEqual([
			'files',
			'home',
		])
	})

	test('删除后的子集保存与再次读取都不会回填', () => {
		const saved = available.filter((kind) => kind !== 'style')
		expect(normalizeRibbonOrder(saved, available)).toEqual(['home', 'tools', 'files'])
		expect(normalizeRibbonOrder(normalizeRibbonOrder(saved, available), available)).toEqual(saved)
	})

	test('空数组表示删除全部标签，损坏数据回退默认顺序', () => {
		expect(normalizeRibbonOrder([], available)).toEqual([])
		expect(normalizeRibbonOrder(null, available)).toEqual([...available])
		expect(normalizeRibbonOrder({ order: ['files'] }, available)).toEqual([...available])
		expect(normalizeRibbonOrder(['unknown', 42], available)).toEqual([...available])
	})

	test('拖动向前或向后调换位置，无效位置不改动', () => {
		expect(moveRibbonItem(available, 3, 1)).toEqual(['home', 'files', 'style', 'tools'])
		expect(moveRibbonItem(available, 0, 2)).toEqual(['style', 'tools', 'home', 'files'])
		expect(moveRibbonItem(available, -1, 2)).toEqual([...available])
		expect(moveRibbonItem(available, 2, 8)).toEqual([...available])
	})

	test('拖动预览按指针越过的中线计算插入位置', () => {
		const midpoints = [35, 105, 175, 245]
		expect(ribbonInsertionIndex(10, midpoints)).toBe(0)
		expect(ribbonInsertionIndex(80, midpoints)).toBe(1)
		expect(ribbonInsertionIndex(190, midpoints)).toBe(3)
		expect(ribbonInsertionIndex(280, midpoints)).toBe(4)
	})

	test('视觉预览仅挤位，拖动源与范围外标签按目标偏移', () => {
		expect(available.map((_, index) => ribbonDragOffset(index, 0, 2))).toEqual([2, -1, -1, 0])
		expect(available.map((_, index) => ribbonDragOffset(index, 3, 1))).toEqual([0, 1, 1, -2])
		expect(available.map((_, index) => ribbonDragOffset(index, 2, 2))).toEqual([0, 0, 0, 0])
	})
})
