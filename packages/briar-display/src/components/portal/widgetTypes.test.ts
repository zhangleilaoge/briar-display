import { describe, expect, test } from 'bun:test'
import { SIZE_SPECS, WIDGET_META, parseStoredLayout } from './widgetTypes'

describe('门户小组件尺寸', () => {
	test('标签使用宽 × 高', () => {
		expect(Object.values(SIZE_SPECS).map((spec) => spec.label)).toEqual(['1 × 1', '2 × 1', '2 × 2'])
	})

	test('日历保留小和中，天气 / 时钟 / 股票只保留小', () => {
		expect(WIDGET_META.calendar.sizes).toEqual(['1x1', '2x1'])
		expect(WIDGET_META.weather.sizes).toEqual(['1x1'])
		expect(WIDGET_META.clock.sizes).toEqual(['1x1'])
		expect(WIDGET_META.stocks.sizes).toEqual(['1x1'])
	})

	test('旧布局中取消的尺寸回退默认，日历中号保留', () => {
		const raw = JSON.stringify([
			{ id: 'calendar', size: '2x1', col: 0, row: 0 },
			{ id: 'weather', size: '2x2', col: 1, row: 0 },
			{ id: 'clock', size: '2x2', col: 2, row: 0 },
			{ id: 'stocks', size: '2x1', col: 3, row: 0 },
		])
		expect(parseStoredLayout(raw)?.map(({ id, size }) => ({ id, size }))).toEqual([
			{ id: 'calendar', size: '2x1' },
			{ id: 'weather', size: '1x1' },
			{ id: 'clock', size: '1x1' },
			{ id: 'stocks', size: '1x1' },
		])
	})
})
