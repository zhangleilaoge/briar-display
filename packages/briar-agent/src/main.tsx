import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { config } from 'dotenv'
import { render } from 'ink'
import React from 'react'
import { App } from './cli.js'
import { KimiCode } from './client/index.js'
import { runPlainInteractive, runSingle } from './modes.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

function initEnv() {
	if (process.env.KIMI_API_KEY) return
	const paths = [
		resolve(__dirname, '../../briar-assets/briar/.env'),
		resolve(process.cwd(), 'briar-assets/briar/.env'),
		resolve(process.cwd(), '../briar-assets/briar/.env'),
	]
	for (const p of paths) {
		try {
			config({ path: p })
			if (process.env.KIMI_API_KEY) return
		} catch {
			/* ignore */
		}
	}
}
initEnv()

/* =================================================================
 *  入口
 * ================================================================= */

export async function main() {
	const args = process.argv.slice(2)
	let prompt = ''
	let stream = false
	let useCli = false

	for (let i = 0; i < args.length; i++) {
		const arg = args[i]
		if (arg === '-p' || arg === '--prompt') {
			prompt = args[++i] || ''
		} else if (arg === '--stream') {
			stream = true
		} else if (arg === '--cli') {
			useCli = true
		} else if (!arg.startsWith('-') && !prompt) {
			prompt = arg
		}
	}

	const apiKey = process.env.KIMI_API_KEY
	const kimi = new KimiCode({ apiKey: apiKey || undefined })

	if (!prompt) {
		if (!args.includes('--no-stream')) stream = true
		if (process.stdin.isTTY) {
			render(<App kimi={kimi} useCli={useCli} streamMode={stream} />)
		} else {
			await runPlainInteractive(kimi, useCli, stream)
		}
	} else {
		await runSingle(prompt, useCli, stream)
	}
}

main()
