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
		this.log('INFO', msg)
	}

	warn(msg: string) {
		this.log('WARN', msg)
	}

	error(msg: string) {
		this.log('ERROR', msg)
	}

	debug(msg: string) {
		if (process.env.LOG_LEVEL === 'debug') {
			this.log('DEBUG', msg)
		}
	}

	private log(level: string, msg: string) {
		const ts = new Date().toLocaleTimeString('zh-CN', { hour12: false })
		const line = `[${ts}] [${level}] ${msg}`
		if (level === 'ERROR') {
			console.error(line)
		} else {
			console.log(line)
		}
		if (this.logFile) {
			fs.appendFileSync(this.logFile, `${line}\n`)
		}
	}
}
