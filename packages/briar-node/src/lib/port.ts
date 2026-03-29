import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export const releasePort = async (port: number) => {
	if (!Number.isFinite(port) || port <= 0) return
	if (process.platform !== 'darwin' && process.platform !== 'linux') return

	try {
		const { stdout } = await execAsync(`lsof -ti:${port}`)
		const pids = stdout
			.split(/\s+/)
			.map((pid) => pid.trim())
			.filter(Boolean)

		if (pids.length === 0) return

		await execAsync(`kill -9 ${pids.join(' ')}`)
		console.log(`🧹 释放端口 ${port} (PID: ${pids.join(', ')})`)
	} catch (error) {
		const execError = error as { code?: number; message?: string }
		if (execError.code === 1) return
		console.warn('⚠️ 端口释放失败:', execError.message ?? execError)
	}
}
