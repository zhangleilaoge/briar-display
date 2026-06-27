import fs from 'node:fs'
import path from 'node:path'

export class Logger {
	private logFile: string | null

	constructor(logFile?: string) {
		this.logFile = logFile ?? null
		if (this.logFile) {
			fs.mkdirSync(path.dirname(this.logFile), { recursive: true })
			fs.writeFileSync(
				this.logFile,
				`=== ${new Date().toISOString().replace('T', ' ').slice(0, 19)} ===\n\n`,
			)
		}
	}

	info(msg: string) {
		const ts = new Date().toLocaleTimeString('zh-CN', { hour12: false })
		const line = `[${ts}] ${msg}`
		console.log(line)
		if (this.logFile) {
			fs.appendFileSync(this.logFile, `${line}\n`)
		}
	}
}
