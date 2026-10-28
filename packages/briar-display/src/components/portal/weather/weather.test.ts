import { describe, expect, test } from 'bun:test'
import {
	DEFAULT_WEATHER_LOCATION,
	MAX_WEATHER_LOCATIONS,
	dailyDateLabel,
	normalizeWeatherLocations,
	upcomingHours,
	windDirectionName,
	windForce,
	windLabel,
	wmoInfo,
} from './weather'
import { parseForecastResponse } from './weatherApi'

describe('天气地区偏好', () => {
	test('剔除坏数据并按地区 id 去重', () => {
		const result = normalizeWeatherLocations([
			DEFAULT_WEATHER_LOCATION,
			{ ...DEFAULT_WEATHER_LOCATION, name: '重复杭州' },
			{ ...DEFAULT_WEATHER_LOCATION, id: 2, latitude: 1000 },
			{ ...DEFAULT_WEATHER_LOCATION, id: 3, name: '' },
			null,
		])
		expect(result).toEqual([DEFAULT_WEATHER_LOCATION])
	})

	test('非法输入为空数组，有效地区最多保留规定数量', () => {
		expect(normalizeWeatherLocations('{bad')).toEqual([])
		expect(normalizeWeatherLocations({})).toEqual([])
		const rows = Array.from({ length: MAX_WEATHER_LOCATIONS + 3 }, (_, index) => ({
			...DEFAULT_WEATHER_LOCATION,
			id: index + 1,
		}))
		expect(normalizeWeatherLocations(rows)).toHaveLength(MAX_WEATHER_LOCATIONS)
	})
})

describe('天气语义', () => {
	test('WMO 区分昼夜、降水和雷暴', () => {
		expect(wmoInfo(0, true)).toEqual({ label: '晴', kind: 'sun' })
		expect(wmoInfo(0, false)).toEqual({ label: '晴', kind: 'moon' })
		expect(wmoInfo(80).kind).toBe('rain')
		expect(wmoInfo(95).kind).toBe('storm')
	})

	test('风向支持角度归一化，风速换算蒲福风级', () => {
		expect(windDirectionName(0)).toBe('北')
		expect(windDirectionName(90)).toBe('东')
		expect(windDirectionName(-90)).toBe('西')
		expect(windDirectionName(360)).toBe('北')
		expect(windForce(0)).toBe(0)
		expect(windForce(6)).toBe(2)
		expect(windForce(118)).toBe(12)
		expect(windLabel(5.8, 135)).toBe('东南风 1级')
	})
})

const response = {
	timezone: 'Asia/Shanghai',
	current: {
		time: '2026-10-29T23:15',
		temperature_2m: 15,
		apparent_temperature: 14.5,
		relative_humidity_2m: 85,
		weather_code: 0,
		is_day: 0,
		wind_speed_10m: 5.8,
		wind_direction_10m: 112,
	},
	hourly: {
		time: ['2026-10-29T22:00', '2026-10-29T23:00', '2026-10-30T00:00'],
		temperature_2m: [16, 15, 14],
		weather_code: [0, 0, 1],
		precipitation_probability: [0, 0, 10],
	},
	daily: {
		time: ['2026-10-29', '2026-10-30'],
		weather_code: [0, 1],
		temperature_2m_max: [24, 25],
		temperature_2m_min: [13, 14],
		precipitation_probability_max: [0, 10],
		wind_speed_10m_max: [12, 13],
		wind_direction_10m_dominant: [90, 180],
	},
}

describe('天气预报解析', () => {
	test('映射当前、逐小时和逐日数据', () => {
		const forecast = parseForecastResponse(response, 123)
		expect(forecast.fetchedAt).toBe(123)
		expect(forecast.current.isDay).toBe(false)
		expect(forecast.current.apparentTemperature).toBe(14.5)
		expect(forecast.hourly).toHaveLength(3)
		expect(forecast.daily[1]).toMatchObject({
			date: '2026-10-30',
			temperatureMax: 25,
			windDirection: 180,
		})
	})

	test('24 小时从当地当前小时开始并跨过午夜', () => {
		const forecast = parseForecastResponse(response)
		expect(upcomingHours(forecast).map((hour) => hour.time)).toEqual([
			'2026-10-29T23:00',
			'2026-10-30T00:00',
		])
	})

	test('不完整响应明确失败', () => {
		expect(() => parseForecastResponse(null)).toThrow('天气预报响应无效')
		expect(() => parseForecastResponse({ current: {} })).toThrow('天气预报数据不完整')
	})

	test('日期标签不依赖浏览器时区', () => {
		expect(dailyDateLabel('2026-10-29', 0)).toBe('今天')
		expect(dailyDateLabel('2026-10-30', 1)).toBe('明天')
		expect(dailyDateLabel('2026-10-31', 2)).toBe('周六')
	})
})
