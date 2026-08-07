import { readFileSync } from 'fs'
import type { Duplex } from 'stream'
import { PERMISSIONS, generateId } from '@briar/shared'
import type { ServerType } from '@hono/node-server'
import { Client as SshClient } from 'ssh2'
import { WebSocketServer } from 'ws'
import { terminalAuditDal } from '../dal/terminalAuditDal'
import { authService } from '../services/authService'
import { permissionService } from '../services/permissionService'
import { resolveDeployKeyPath, terminalService } from '../services/terminalService'

const WS_PATH = '/api/terminal/ws'
const IDLE_TIMEOUT = 30 * 60 * 1000 // 30 分钟无输入自动断开

type ClientMessage =
	| { type: 'input'; data: string }
	| { type: 'resize'; cols: number; rows: number }

function rejectSocket(socket: Duplex, status: string) {
	socket.write(`HTTP/1.1 ${status}\r\nConnection: close\r\n\r\n`)
	socket.destroy()
}

function parseCookies(header: string | undefined): Record<string, string> {
	const cookies: Record<string, string> = {}
	for (const pair of (header || '').split(';')) {
		const idx = pair.indexOf('=')
		if (idx > 0) cookies[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim()
	}
	return cookies
}

/** 从输入流中提取命令行用于审计：累积可打印字符，回车刷新，退格回删 */
function createInputTracker(onLine: (line: string) => void) {
	let buffer = ''
	return (data: string) => {
		for (const ch of data) {
			if (ch === '\r' || ch === '\n') {
				const line = buffer.trim()
				buffer = ''
				if (line) onLine(line)
			} else if (ch === '\x7f' || ch === '\b') {
				buffer = buffer.slice(0, -1)
			} else if (ch >= ' ' && ch !== '\x1b') {
				buffer += ch
			}
			// 其他控制字符（方向键等转义序列）忽略
		}
	}
}

/**
 * SSH 控制台 WebSocket 桥接。
 * 直接挂在 http server 的 upgrade 事件上（不经 Hono），自行完成 cookie 鉴权 + 权限校验。
 * SSH 目标复用 .env 的 DEPLOY_* 配置。
 */
export function setupTerminalWebSocket(server: ServerType) {
	const wss = new WebSocketServer({ noServer: true })

	server.on('upgrade', async (req, socket, head) => {
		const url = new URL(req.url || '', 'http://localhost')
		if (url.pathname !== WS_PATH) {
			rejectSocket(socket, '404 Not Found')
			return
		}

		try {
			const token =
				parseCookies(req.headers.cookie).briar_token || url.searchParams.get('token') || ''
			if (!token) return rejectSocket(socket, '401 Unauthorized')

			const payload = authService.verifyToken(token)
			const user = await authService.getUserById(payload.sub)
			if (!user) return rejectSocket(socket, '401 Unauthorized')

			const isAdmin = await permissionService.isAdmin(user.id)
			const allowed =
				isAdmin ||
				(await permissionService.hasPermission(user.id, PERMISSIONS.ADMIN_TERMINAL_ACCESS))
			if (!allowed) return rejectSocket(socket, '403 Forbidden')

			// 设备授权：邮箱验证码换取的 7 天设备令牌
			const deviceToken = url.searchParams.get('device') || ''
			if (!terminalService.verifyDeviceToken(deviceToken, user.id)) {
				return rejectSocket(socket, '403 Device Not Authorized')
			}

			const cols = Math.min(300, Math.max(20, Number(url.searchParams.get('cols')) || 80))
			const rows = Math.min(100, Math.max(5, Number(url.searchParams.get('rows')) || 24))

			wss.handleUpgrade(req, socket, head, (ws) => {
				const sessionId = generateId()
				const audit = (event: 'connect' | 'input' | 'close', data?: string) =>
					void terminalAuditDal.log({
						sessionId,
						userId: user.id,
						userName: user.name,
						event,
						data,
					})
				const trackInput = createInputTracker((line) => audit('input', line))

				audit('connect', `${process.env.DEPLOY_USER || ''}@${process.env.DEPLOY_HOST || ''}`)

				const send = (payload: Record<string, unknown>) => {
					if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(payload))
				}

				// 空闲超时（输入会刷新计时）
				let idleTimer = setTimeout(() => ws.close(4000, 'idle timeout'), IDLE_TIMEOUT)
				const refreshIdle = () => {
					clearTimeout(idleTimer)
					idleTimer = setTimeout(() => ws.close(4000, 'idle timeout'), IDLE_TIMEOUT)
				}

				const ssh = new SshClient()
				let closed = false
				const cleanup = () => {
					if (closed) return
					closed = true
					clearTimeout(idleTimer)
					audit('close')
					ssh.end()
					if (ws.readyState === ws.OPEN) ws.close()
				}

				ssh.on('ready', () => {
					ssh.shell({ term: 'xterm-256color', cols, rows }, (err, stream) => {
						if (err) {
							send({ type: 'status', status: 'error', message: err.message })
							cleanup()
							return
						}
						send({ type: 'status', status: 'connected' })
						stream.on('data', (data: Buffer) => {
							send({ type: 'data', data: data.toString('utf-8') })
						})
						stream.on('close', () => {
							send({ type: 'status', status: 'closed' })
							cleanup()
						})

						ws.on('message', (raw) => {
							refreshIdle()
							let msg: ClientMessage
							try {
								msg = JSON.parse(raw.toString())
							} catch {
								return
							}
							if (msg.type === 'input' && typeof msg.data === 'string') {
								trackInput(msg.data)
								stream.write(msg.data)
							} else if (msg.type === 'resize' && msg.cols > 0 && msg.rows > 0) {
								stream.setWindow(msg.rows, msg.cols, 0, 0)
							}
						})
					})
				})

				ssh.on('error', (err) => {
					send({ type: 'status', status: 'error', message: err.message })
					cleanup()
				})
				ssh.on('close', () => cleanup())
				ws.on('close', () => cleanup())

				// 密钥优先（DEPLOY_KEY_PATH 指向私钥文件，相对路径基于仓库根目录解析），否则回退密码
				const keyPath = resolveDeployKeyPath()
				ssh.connect({
					host: process.env.DEPLOY_HOST,
					port: Number(process.env.DEPLOY_PORT) || 22,
					username: process.env.DEPLOY_USER,
					...(keyPath
						? { privateKey: readFileSync(keyPath) }
						: { password: process.env.DEPLOY_PASS }),
					readyTimeout: 10_000,
				})
			})
		} catch {
			rejectSocket(socket, '401 Unauthorized')
		}
	})
}
