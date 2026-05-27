#!/usr/bin/env node
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { main } from '@earendil-works/pi-coding-agent'
import { config } from 'dotenv'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '../../.env') })

if (process.env.BRIAR_API_KEY && !process.env.KIMI_API_KEY) {
	process.env.KIMI_API_KEY = process.env.BRIAR_API_KEY
}

await main(process.argv.slice(2))
