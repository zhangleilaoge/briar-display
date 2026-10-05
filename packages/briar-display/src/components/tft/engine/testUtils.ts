import { describe, expect, it } from 'bun:test'
import type { PlayerState } from './types'

export const makePlayer = (level = 9): PlayerState => ({
	id: 0,
	name: 'test',
	isBot: false,
	hp: 100,
	gold: 0,
	xp: 0,
	level,
	streakType: 'none',
	streakCount: 0,
	bench: Array(9).fill(null),
	board: [],
	itemTray: [],
	shop: [null, null, null, null, null],
	shopLocked: false,
	alive: true,
	placement: 0,
	lastOpponentId: null,
	augments: [],
	freeRerolls: 0,
})
