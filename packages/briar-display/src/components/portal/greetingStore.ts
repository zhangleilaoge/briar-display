'use client'

import { isTokenUsable } from '@/api/auth'
import { getPreference, putPreference } from '@/api/users'
import {
	dailyGreetingIndex,
	pickGreetingAt,
	pickRandomGreeting,
	pickTimeOfDayGreeting,
	shanghaiDateKey,
} from '@/data/daily-greetings'
import { useCallback, useEffect, useSyncExternalStore } from 'react'

const PREF_KEY = 'portal-greeting'
const LOCAL_KEY = 'briar:portal-greeting'

export interface PortalGreetingPref {
	day: string
	index: number
}

export interface GreetingView {
	tod: string
	greet: string
	author: string
	line: string
	date: string
	index: number
	ready: boolean
}

const EMPTY: GreetingView = {
	tod: '',
	greet: '',
	author: '',
	line: '',
	date: '',
	index: -1,
	ready: false,
}

let view: GreetingView = EMPTY
const listeners = new Set<() => void>()

let initPromise: Promise<void> | null = null
let spinning = false
const spinListeners = new Set<() => void>()

const emit = (next: Partial<GreetingView>) => {
	view = { ...view, ...next }
	for (const l of listeners) l()
}

const emitSpin = (v: boolean) => {
	spinning = v
	for (const l of spinListeners) l()
}

function fromPref(pref: PortalGreetingPref): GreetingView {
	const g = pickGreetingAt(pref.index)
	return {
		tod: pickTimeOfDayGreeting(),
		greet: g.greet,
		author: g.author || '',
		line: g.line,
		date: g.dateLabel,
		index: g.index,
		ready: true,
	}
}

function dailyView(): GreetingView {
	const index = dailyGreetingIndex()
	const g = pickGreetingAt(index)
	return {
		tod: pickTimeOfDayGreeting(),
		greet: g.greet,
		author: g.author || '',
		line: g.line,
		date: g.dateLabel,
		index: g.index,
		ready: true,
	}
}

function readLocal(): PortalGreetingPref | null {
	try {
		const raw = window.localStorage.getItem(LOCAL_KEY)
		if (!raw) return null
		const parsed = JSON.parse(raw) as PortalGreetingPref
		if (typeof parsed?.day !== 'string' || typeof parsed?.index !== 'number') {
			return null
		}
		return { day: parsed.day, index: parsed.index }
	} catch {
		return null
	}
}

function writeLocal(pref: PortalGreetingPref) {
	window.localStorage.setItem(LOCAL_KEY, JSON.stringify(pref))
}

function isValidToday(pref: PortalGreetingPref | null): pref is PortalGreetingPref {
	return !!pref && pref.day === shanghaiDateKey()
}

function applyPref(pref: PortalGreetingPref) {
	writeLocal(pref)
	emit(fromPref(pref))
}

async function persist(pref: PortalGreetingPref) {
	writeLocal(pref)
	if (!isTokenUsable()) return
	try {
		await putPreference(PREF_KEY, pref)
	} catch {
		// 写库失败仍保留本机，下次登录再同步
	}
}

function initGreeting(): Promise<void> {
	if (initPromise) return initPromise
	initPromise = (async () => {
		const local = readLocal()
		if (isValidToday(local)) {
			emit(fromPref(local))
		} else {
			emit(dailyView())
		}

		if (!isTokenUsable()) return

		try {
			const res = await getPreference(PREF_KEY)
			const raw = res.success ? (res.data?.value as PortalGreetingPref | null) : null
			const value =
				raw && typeof raw.day === 'string' && typeof raw.index === 'number'
					? { day: raw.day, index: raw.index }
					: null
			if (isValidToday(value)) {
				applyPref(value)
				return
			}
			// 服务端无当日记录：若本机有换一句结果则上传；否则日种子即可
			if (isValidToday(local) && local.index !== dailyGreetingIndex()) {
				await persist(local)
			}
		} catch {
			// 保持已展示的本机 / 日种子
		}
	})()
	return initPromise
}

export async function shuffleGreeting() {
	await initGreeting()
	const next = pickRandomGreeting([view.index])
	const pref: PortalGreetingPref = {
		day: shanghaiDateKey(),
		index: next.index,
	}
	emit({
		tod: pickTimeOfDayGreeting(),
		greet: next.greet,
		author: next.author || '',
		line: next.line,
		date: next.dateLabel,
		index: next.index,
		ready: true,
	})
	emitSpin(true)
	window.setTimeout(() => emitSpin(false), 480)
	void persist(pref)
}

const subscribe = (l: () => void) => {
	listeners.add(l)
	return () => {
		listeners.delete(l)
	}
}
const getSnapshot = () => view
const getServerSnapshot = () => EMPTY

const subscribeSpin = (l: () => void) => {
	spinListeners.add(l)
	return () => {
		spinListeners.delete(l)
	}
}
const getSpinSnapshot = () => spinning
const getSpinServer = () => false

/** PortalPage 与 GreetingWidget 共用：优先读库/本机当日换一句，否则日种子 */
export function useGreeting() {
	const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
	const isSpinning = useSyncExternalStore(subscribeSpin, getSpinSnapshot, getSpinServer)
	useEffect(() => {
		void initGreeting()
	}, [])
	const shuffle = useCallback(() => {
		void shuffleGreeting()
	}, [])
	return { ...state, spinning: isSpinning, shuffle }
}
