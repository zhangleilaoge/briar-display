export interface WeatherLocation {
	id: number
	name: string
	latitude: number
	longitude: number
	country?: string
	admin1?: string
	timezone: string
}

export interface CurrentWeather {
	time: string
	temperature: number
	apparentTemperature: number
	humidity: number
	code: number
	isDay: boolean
	windSpeed: number
	windDirection: number
}

export interface HourlyWeather {
	time: string
	temperature: number
	code: number
	precipitationProbability: number
}

export interface DailyWeather {
	date: string
	code: number
	temperatureMax: number
	temperatureMin: number
	precipitationProbability: number
	windSpeed: number
	windDirection: number
}

export interface WeatherForecast {
	timezone: string
	current: CurrentWeather
	hourly: HourlyWeather[]
	daily: DailyWeather[]
	fetchedAt: number
}

export type WeatherKind =
	| 'sun'
	| 'moon'
	| 'cloud-sun'
	| 'cloud-moon'
	| 'cloud'
	| 'fog'
	| 'drizzle'
	| 'rain'
	| 'snow'
	| 'storm'

export const MAX_WEATHER_LOCATIONS = 6
export const DEFAULT_WEATHER_LOCATION: WeatherLocation = {
	id: 1808926,
	name: '杭州',
	latitude: 30.2741,
	longitude: 120.1551,
	country: '中国',
	admin1: '浙江省',
	timezone: 'Asia/Shanghai',
}
export const DEFAULT_WEATHER_LOCATIONS = [DEFAULT_WEATHER_LOCATION]

const optionalText = (value: unknown) =>
	typeof value === 'string' && value.trim() ? value.trim().slice(0, 120) : undefined

export function normalizeWeatherLocations(value: unknown): WeatherLocation[] {
	if (!Array.isArray(value)) return []
	const result: WeatherLocation[] = []
	const seen = new Set<number>()
	for (const item of value) {
		if (!item || typeof item !== 'object') continue
		const row = item as Record<string, unknown>
		const id = Number(row.id)
		const latitude = Number(row.latitude)
		const longitude = Number(row.longitude)
		const name = optionalText(row.name)
		const timezone = optionalText(row.timezone)
		if (
			!Number.isInteger(id) ||
			id <= 0 ||
			seen.has(id) ||
			!name ||
			!timezone ||
			!Number.isFinite(latitude) ||
			latitude < -90 ||
			latitude > 90 ||
			!Number.isFinite(longitude) ||
			longitude < -180 ||
			longitude > 180
		) {
			continue
		}
		seen.add(id)
		result.push({
			id,
			name,
			latitude,
			longitude,
			country: optionalText(row.country),
			admin1: optionalText(row.admin1),
			timezone,
		})
		if (result.length === MAX_WEATHER_LOCATIONS) break
	}
	return result
}

export function weatherLocationLabel(location: WeatherLocation) {
	return [...new Set([location.admin1, location.country].filter(Boolean))].join(' · ')
}

export function wmoInfo(code: number, isDay = true): { label: string; kind: WeatherKind } {
	if (code === 0) return { label: '晴', kind: isDay ? 'sun' : 'moon' }
	if (code === 1) return { label: '晴间多云', kind: isDay ? 'cloud-sun' : 'cloud-moon' }
	if (code === 2) return { label: '多云', kind: isDay ? 'cloud-sun' : 'cloud-moon' }
	if (code === 3) return { label: '阴', kind: 'cloud' }
	if (code === 45 || code === 48) return { label: '雾', kind: 'fog' }
	if ([51, 53, 55, 56, 57].includes(code)) return { label: '毛毛雨', kind: 'drizzle' }
	if ([61, 63, 65].includes(code)) return { label: '雨', kind: 'rain' }
	if (code === 66 || code === 67) return { label: '冻雨', kind: 'rain' }
	if ([71, 73, 75, 77].includes(code)) return { label: '雪', kind: 'snow' }
	if ([80, 81, 82].includes(code)) return { label: '阵雨', kind: 'rain' }
	if (code === 85 || code === 86) return { label: '阵雪', kind: 'snow' }
	if (code === 95) return { label: '雷暴', kind: 'storm' }
	if (code === 96 || code === 99) return { label: '雷雨夹冰雹', kind: 'storm' }
	return { label: '未知天气', kind: 'cloud' }
}

const WIND_DIRECTIONS = ['北', '东北', '东', '东南', '南', '西南', '西', '西北']
const WIND_FORCE_THRESHOLDS = [1, 6, 12, 20, 29, 39, 50, 62, 75, 89, 103, 118]

export function windDirectionName(degrees: number) {
	if (!Number.isFinite(degrees)) return '不定'
	const normalized = ((degrees % 360) + 360) % 360
	return WIND_DIRECTIONS[Math.round(normalized / 45) % WIND_DIRECTIONS.length]
}

export function windForce(speedKmh: number) {
	if (!Number.isFinite(speedKmh) || speedKmh < 0) return 0
	return WIND_FORCE_THRESHOLDS.filter((threshold) => speedKmh >= threshold).length
}

export function windLabel(speedKmh: number, direction: number) {
	return `${windDirectionName(direction)}风 ${windForce(speedKmh)}级`
}

export function upcomingHours(forecast: WeatherForecast, count = 24) {
	const currentHour = forecast.current.time.slice(0, 13)
	let start = forecast.hourly.findIndex((hour) => hour.time.slice(0, 13) === currentHour)
	if (start < 0) start = forecast.hourly.findIndex((hour) => hour.time >= forecast.current.time)
	return forecast.hourly.slice(Math.max(0, start), Math.max(0, start) + count)
}

export function dailyDateLabel(date: string, index: number) {
	if (index === 0) return '今天'
	if (index === 1) return '明天'
	return new Intl.DateTimeFormat('zh-CN', { weekday: 'short', timeZone: 'UTC' }).format(
		new Date(`${date}T00:00:00Z`),
	)
}
