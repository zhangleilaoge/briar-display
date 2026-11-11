export const TERMINAL_TAB_NAMES_KEY = 'briar_terminal_tab_names'
export const TERMINAL_TAB_NAME_MAX_LENGTH = 24

type ReadStorage = Pick<Storage, 'getItem'>
type WriteStorage = Pick<Storage, 'setItem'>

export function normalizeTerminalTabName(value: string): string {
	return value.trim().replace(/\s+/g, ' ').slice(0, TERMINAL_TAB_NAME_MAX_LENGTH)
}

export function readTerminalTabNames(storage: ReadStorage): Record<string, string> {
	try {
		const raw = storage.getItem(TERMINAL_TAB_NAMES_KEY)
		if (!raw) return {}
		const parsed: unknown = JSON.parse(raw)
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
		return Object.fromEntries(
			Object.entries(parsed).flatMap(([id, value]) => {
				if (!/^\d+$/.test(id) || typeof value !== 'string') return []
				const name = normalizeTerminalTabName(value)
				return name ? [[id, name]] : []
			}),
		)
	} catch {
		return {}
	}
}

export function writeTerminalTabNames(
	storage: WriteStorage,
	names: Readonly<Record<string, string>>,
): boolean {
	try {
		storage.setItem(TERMINAL_TAB_NAMES_KEY, JSON.stringify(names))
		return true
	} catch {
		return false
	}
}
