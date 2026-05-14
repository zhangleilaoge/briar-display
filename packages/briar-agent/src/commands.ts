import type { CommandDef } from './types.js'

export const COMMANDS: CommandDef[] = [
	{ name: '/sub', desc: 'spawn sub-agent' },
	{ name: '/sub-list', desc: 'list sub-agents' },
	{ name: '/sub-view', desc: 'view sub-agent output' },
	{ name: '/subChat', desc: 'chat with sub-agent' },
	{ name: '/clear', desc: 'clear current session' },
	{ name: '/new', desc: 'new session' },
	{ name: '/session', desc: 'switch session' },
	{ name: '/session del', desc: 'delete session' },
	{ name: '/help', desc: 'show help' },
	{ name: '/exit', desc: 'exit' },
]

export function getHelpText(): string {
	return [
		'/sub <prompt>    - spawn a sub-agent',
		'/sub-list        - list sub-agents',
		'/sub-view <id|name> - view full output',
		'/subChat <id|name> <prompt> - continue chat',
		'/clear           - clear current session',
		'/new             - new session',
		'/session         - switch session',
		'/session del <id> - delete session',
		'/exit, /quit     - exit',
		'Ctrl+X           - cancel',
		'↑ ↓              - scroll',
		'→ (empty)        - sub-agent panel',
		'← / Esc          - back',
	].join('\n')
}
