import { spawn } from 'child_process'

export interface KimiCliOptions {
	cliPath?: string
	timeout?: number
	apiKey?: string
}

export interface KimiExecParams {
	prompt: string
	workDir?: string
	outputFormat?: 'text' | 'stream-json'
	model?: string
	timeout?: number
}

export class KimiCliExecutor {
	private cliPath: string
	private defaultTimeout: number
	private apiKey?: string

	constructor(options: KimiCliOptions = {}) {
		this.cliPath = options.cliPath || 'kimi'
		this.defaultTimeout = options.timeout || 600000 // 10 minutes default
		this.apiKey = options.apiKey
	}

	/**
	 * Execute kimi CLI with -y (auto-approve) and --quiet (non-interactive, final message only)
	 */
	async execute(params: KimiExecParams): Promise<string> {
		const args: string[] = ['-y', '--quiet']

		if (params.model) {
			args.push('--model', params.model)
		}

		args.push('-p', params.prompt)

		const timeoutMs = params.timeout || this.defaultTimeout

		return new Promise<string>((resolve, reject) => {
			const childProcess = spawn(this.cliPath, args, {
				cwd: params.workDir,
				env: {
					...process.env,
					...(this.apiKey ? { KIMI_API_KEY: this.apiKey } : {}),
				},
			})

			let stdout = ''
			let stderr = ''

			const timeoutId = setTimeout(() => {
				childProcess.kill()
				reject(new Error(`Kimi CLI execution timed out after ${timeoutMs}ms`))
			}, timeoutMs)

			childProcess.stdout.on('data', (data: Buffer) => {
				stdout += String(data)
			})

			childProcess.stderr.on('data', (data: Buffer) => {
				stderr += String(data)
			})

			childProcess.on('error', (error: Error) => {
				clearTimeout(timeoutId)
				reject(
					new Error(
						`Kimi CLI execution failed: ${error.message}${stderr ? `\nStderr: ${stderr}` : ''}`,
					),
				)
			})

			childProcess.on('close', (code: number | null) => {
				clearTimeout(timeoutId)

				if (code !== 0 && code !== null) {
					reject(
						new Error(
							`Kimi CLI process exited with code ${code}${stderr ? `\nStderr: ${stderr}` : ''}`,
						),
					)
				} else {
					if (stderr) {
						console.error('Kimi CLI stderr:', stderr)
					}
					resolve(stdout)
				}
			})
		})
	}

	/**
	 * Execute kimi CLI in streaming mode (uses --print + stream-json for full output)
	 */
	executeStream(params: KimiExecParams): AsyncGenerator<string> {
		const args: string[] = ['-y', '--print', '--output-format', 'stream-json']

		if (params.model) {
			args.push('--model', params.model)
		}

		args.push('-p', params.prompt)

		const childProcess = spawn(this.cliPath, args, {
			cwd: params.workDir,
			env: {
				...process.env,
				...(this.apiKey ? { KIMI_API_KEY: this.apiKey } : {}),
			},
		})

		const stream = childProcess.stdout

		const generator = async function* () {
			const buffer: string[] = []
			let resolveNext: ((value: IteratorResult<string>) => void) | null = null
			let done = false
			let error: Error | null = null

			stream.on('data', (data: Buffer) => {
				const chunks = String(data).split('\n').filter(Boolean)
				for (const chunk of chunks) {
					if (resolveNext) {
						resolveNext({ value: chunk, done: false })
						resolveNext = null
					} else {
						buffer.push(chunk)
					}
				}
			})

			stream.on('end', () => {
				done = true
				if (resolveNext) {
					resolveNext({ value: undefined, done: true })
				}
			})

			stream.on('error', (err: Error) => {
				error = err
				done = true
				if (resolveNext) {
					resolveNext({ value: undefined, done: true })
				}
			})

			childProcess.on('close', (code: number | null) => {
				if (code !== 0 && code !== null && !error) {
					error = new Error(`Kimi CLI process exited with code ${code}`)
				}
				done = true
				if (resolveNext) {
					resolveNext({ value: undefined, done: true })
				}
			})

			while (!done || buffer.length > 0) {
				if (buffer.length > 0) {
					yield buffer.shift()!
				} else if (!done) {
					const result = await new Promise<IteratorResult<string>>((resolve) => {
						resolveNext = resolve
					})
					if (result.done) break
					if (result.value !== undefined) yield result.value
				} else {
					break
				}
			}

			if (error) throw error
		}

		return generator()
	}
}
