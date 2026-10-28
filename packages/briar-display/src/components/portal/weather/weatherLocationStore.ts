'use client'

import { isTokenUsable } from '@/api/auth'
import { getPreference, putPreference } from '@/api/users'
import { useEffect, useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import {
	DEFAULT_WEATHER_LOCATION,
	DEFAULT_WEATHER_LOCATIONS,
	MAX_WEATHER_LOCATIONS,
	type WeatherLocation,
	normalizeWeatherLocations,
} from './weather'

const PREF_KEY = 'portal-weather-locations'
const LOCAL_KEY = 'briar:portal-weather-locations'

interface WeatherLocationState {
	locations: WeatherLocation[]
	ready: boolean
	mode: 'local' | 'server'
	saving: boolean
}

const INITIAL: WeatherLocationState = {
	locations: DEFAULT_WEATHER_LOCATIONS,
	ready: false,
	mode: 'local',
	saving: false,
}

let state = INITIAL
let initPromise: Promise<void> | null = null
let mutationQueue: Promise<void> = Promise.resolve()
const listeners = new Set<() => void>()

function emit(next: Partial<WeatherLocationState>) {
	state = { ...state, ...next }
	for (const listener of listeners) listener()
}

function readLocal() {
	try {
		const parsed = normalizeWeatherLocations(
			JSON.parse(window.localStorage.getItem(LOCAL_KEY) ?? 'null'),
		)
		return parsed.length ? parsed : DEFAULT_WEATHER_LOCATIONS
	} catch {
		return DEFAULT_WEATHER_LOCATIONS
	}
}

function writeLocal(locations: WeatherLocation[]) {
	try {
		window.localStorage.setItem(LOCAL_KEY, JSON.stringify(locations))
	} catch {
		return
	}
}

function hasCustomLocal(locations: WeatherLocation[]) {
	return !(
		locations.length === 1 &&
		locations[0].id === DEFAULT_WEATHER_LOCATION.id &&
		locations[0].latitude === DEFAULT_WEATHER_LOCATION.latitude &&
		locations[0].longitude === DEFAULT_WEATHER_LOCATION.longitude
	)
}

function initLocations(): Promise<void> {
	if (initPromise) return initPromise
	initPromise = (async () => {
		const local = readLocal()
		emit({ locations: local, ready: true, mode: 'local' })
		if (!isTokenUsable()) return
		try {
			const response = await getPreference<unknown>(PREF_KEY)
			if (!response.success) throw new Error(response.message || '读取地区配置失败')
			const server = normalizeWeatherLocations(response.data?.value)
			if (server.length) {
				emit({ locations: server, ready: true, mode: 'server' })
				return
			}
			if (hasCustomLocal(local)) await putPreference(PREF_KEY, local)
			emit({ locations: local, ready: true, mode: 'server' })
		} catch {
			emit({ locations: local, ready: true, mode: 'local' })
		}
	})()
	return initPromise
}

async function persistLocations(locations: WeatherLocation[]) {
	const mode = state.mode
	emit({ locations, saving: mode === 'server' })
	if (mode === 'local') {
		writeLocal(locations)
		emit({ saving: false })
		return
	}
	try {
		const response = await putPreference(PREF_KEY, locations)
		if (!response.success) throw new Error(response.message || '保存失败')
		emit({ saving: false })
	} catch {
		writeLocal(locations)
		emit({ mode: 'local', saving: false })
		toast.error('地区未能保存到账号，已先保留在本机')
	}
}

function enqueue(action: () => Promise<void>) {
	const next = mutationQueue.then(action, action)
	mutationQueue = next.catch(() => undefined)
	return next
}

export function addWeatherLocation(location: WeatherLocation) {
	return enqueue(async () => {
		await initLocations()
		if (state.locations.some((item) => item.id === location.id)) return
		if (state.locations.length >= MAX_WEATHER_LOCATIONS) {
			toast.error(`最多保存 ${MAX_WEATHER_LOCATIONS} 个地区`)
			return
		}
		await persistLocations([...state.locations, location])
	})
}

export function removeWeatherLocation(id: number) {
	return enqueue(async () => {
		await initLocations()
		if (state.locations.length <= 1) {
			toast.error('至少保留一个默认地区')
			return
		}
		await persistLocations(state.locations.filter((location) => location.id !== id))
	})
}

const subscribe = (listener: () => void) => {
	listeners.add(listener)
	return () => listeners.delete(listener)
}

export function useWeatherLocations() {
	const snapshot = useSyncExternalStore(
		subscribe,
		() => state,
		() => INITIAL,
	)
	useEffect(() => {
		void initLocations()
	}, [])
	return { ...snapshot, add: addWeatherLocation, remove: removeWeatherLocation }
}
