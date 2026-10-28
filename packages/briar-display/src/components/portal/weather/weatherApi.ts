import {
	type HourlyWeather,
	type WeatherForecast,
	type WeatherLocation,
	normalizeWeatherLocations,
} from './weather'

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'
const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search'

const finiteNumber = (value: unknown, fallback = 0) => {
	const number = Number(value)
	return Number.isFinite(number) ? number : fallback
}

const numberArray = (value: unknown) => (Array.isArray(value) ? value : [])

export function parseForecastResponse(payload: unknown, fetchedAt = Date.now()): WeatherForecast {
	if (!payload || typeof payload !== 'object') throw new Error('天气预报响应无效')
	const body = payload as Record<string, unknown>
	const current = body.current as Record<string, unknown> | undefined
	const hourly = body.hourly as Record<string, unknown> | undefined
	const daily = body.daily as Record<string, unknown> | undefined
	if (
		!current ||
		typeof current.time !== 'string' ||
		!Number.isFinite(Number(current.temperature_2m)) ||
		!hourly ||
		!daily ||
		!Array.isArray(hourly.time) ||
		!Array.isArray(daily.time)
	) {
		throw new Error('天气预报数据不完整')
	}

	const hourlyTimes = hourly.time as unknown[]
	const hours: HourlyWeather[] = hourlyTimes.flatMap((time, index) =>
		typeof time === 'string'
			? [
					{
						time,
						temperature: finiteNumber(numberArray(hourly.temperature_2m)[index]),
						code: finiteNumber(numberArray(hourly.weather_code)[index]),
						precipitationProbability: finiteNumber(
							numberArray(hourly.precipitation_probability)[index],
						),
					},
				]
			: [],
	)
	const days = (daily.time as unknown[]).flatMap((date, index) =>
		typeof date === 'string'
			? [
					{
						date,
						code: finiteNumber(numberArray(daily.weather_code)[index]),
						temperatureMax: finiteNumber(numberArray(daily.temperature_2m_max)[index]),
						temperatureMin: finiteNumber(numberArray(daily.temperature_2m_min)[index]),
						precipitationProbability: finiteNumber(
							numberArray(daily.precipitation_probability_max)[index],
						),
						windSpeed: finiteNumber(numberArray(daily.wind_speed_10m_max)[index]),
						windDirection: finiteNumber(numberArray(daily.wind_direction_10m_dominant)[index]),
					},
				]
			: [],
	)
	if (!hours.length || !days.length) throw new Error('天气预报数据不完整')

	return {
		timezone: typeof body.timezone === 'string' ? body.timezone : 'UTC',
		current: {
			time: current.time,
			temperature: Number(current.temperature_2m),
			apparentTemperature: finiteNumber(
				current.apparent_temperature,
				Number(current.temperature_2m),
			),
			humidity: finiteNumber(current.relative_humidity_2m),
			code: finiteNumber(current.weather_code),
			isDay: current.is_day !== 0,
			windSpeed: finiteNumber(current.wind_speed_10m),
			windDirection: finiteNumber(current.wind_direction_10m),
		},
		hourly: hours,
		daily: days,
		fetchedAt,
	}
}

async function fetchJson(url: URL, signal?: AbortSignal): Promise<unknown> {
	const response = await fetch(url, { signal, headers: { Accept: 'application/json' } })
	if (!response.ok) throw new Error(`天气服务请求失败（${response.status}）`)
	const body = (await response.json()) as Record<string, unknown>
	if (body.error) throw new Error(typeof body.reason === 'string' ? body.reason : '天气服务不可用')
	return body
}

export async function getWeatherForecast(location: WeatherLocation, signal?: AbortSignal) {
	const url = new URL(FORECAST_URL)
	url.searchParams.set('latitude', String(location.latitude))
	url.searchParams.set('longitude', String(location.longitude))
	url.searchParams.set(
		'current',
		'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m,wind_direction_10m',
	)
	url.searchParams.set('hourly', 'temperature_2m,weather_code,precipitation_probability')
	url.searchParams.set(
		'daily',
		'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,wind_direction_10m_dominant',
	)
	url.searchParams.set('timezone', 'auto')
	url.searchParams.set('forecast_days', '7')
	url.searchParams.set('wind_speed_unit', 'kmh')
	return parseForecastResponse(await fetchJson(url, signal))
}

export async function searchWeatherLocations(query: string, signal?: AbortSignal) {
	const name = query.trim()
	if (name.length < 2) return []
	const url = new URL(GEOCODING_URL)
	url.searchParams.set('name', name)
	url.searchParams.set('count', '8')
	url.searchParams.set('language', 'zh')
	url.searchParams.set('format', 'json')
	const body = (await fetchJson(url, signal)) as { results?: unknown }
	return normalizeWeatherLocations(body.results)
}
