import type { KimiCode } from '../client/index.js'
import type { AppState } from '../hooks/use-app-state.js'
import type { SessionPersistence } from '../hooks/use-session-persistence.js'

export interface CommandContext {
	kimi: KimiCode
	useCli: boolean
	streamMode: boolean
	exit: () => void
	appState: AppState
	sessions: SessionPersistence
}
