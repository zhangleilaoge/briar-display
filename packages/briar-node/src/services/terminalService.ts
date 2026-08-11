import { readFileSync } from 'fs'
import { isAbsolute, resolve } from 'path'
import jwt from 'jsonwebtoken'
import { Client as SshClient } from 'ssh2'
import { AUTH_CONFIG } from '../config/auth'
import { VerificationCodeType, verificationCodeDal } from '../dal/verificationCodeDal'
import { findRepoRoot } from './certificate/utils'
import { EmailTemplate, emailService } from './emailService'

const DEVICE_TOKEN_PURPOSE = 'terminal-device'
const DEVICE_TOKEN_EXPIRES_IN = '7d'
const CODE_EXPIRES_MS = 15 * 60 * 1000 // 验证码 15 分钟有效
const HOST_INFO_CACHE_MS = 10 * 1000 // 服务器信息缓存 10s，避免轮询打满 SSH

export interface DeviceTokenPayload {
	sub: string
	purpose: typeof DEVICE_TOKEN_PURPOSE
}

export interface HostInfo {
	hostname: string
	os: string
	cpuModel: string
	cpuCores: number
	uptime: string
	load: [number, number, number]
	mem: { totalMb: number; usedMb: number; availableMb: number }
	disk: { size: string; used: string; avail: string; usePercent: number; mount: string }
	collectedAt: string
}

let hostInfoCache: { data: HostInfo; at: number } | null = null

/** 解析 DEPLOY_KEY_PATH（相对路径基于仓库根目录） */
export function resolveDeployKeyPath(): string | undefined {
	const keyPath = process.env.DEPLOY_KEY_PATH
	if (!keyPath) return undefined
	return isAbsolute(keyPath) ? keyPath : resolve(findRepoRoot(process.cwd()), keyPath)
}

/** 建立一条 SSH 连接（复用 DEPLOY_* 配置） */
function createSshConnection(): Promise<SshClient> {
	return new Promise((resolvePromise, reject) => {
		const ssh = new SshClient()
		const keyPath = resolveDeployKeyPath()
		ssh.on('ready', () => resolvePromise(ssh))
		ssh.on('error', reject)
		ssh.connect({
			host: process.env.DEPLOY_HOST,
			port: Number(process.env.DEPLOY_PORT) || 22,
			username: process.env.DEPLOY_USER,
			...(keyPath ? { privateKey: readFileSync(keyPath) } : { password: process.env.DEPLOY_PASS }),
			readyTimeout: 10_000,
		})
	})
}

function execCommand(ssh: SshClient, command: string): Promise<string> {
	return new Promise((resolvePromise, reject) => {
		ssh.exec(command, (err, stream) => {
			if (err) return reject(err)
			let output = ''
			stream.on('data', (data: Buffer) => {
				output += data.toString('utf-8')
			})
			stream.on('close', () => resolvePromise(output))
		})
	})
}

/** 解析组合命令输出（各段以 @section 标记分隔） */
function parseHostInfo(raw: string): HostInfo {
	const sections: Record<string, string> = {}
	let current = ''
	for (const line of raw.split('\n')) {
		const trimmed = line.trim()
		if (trimmed.startsWith('@')) {
			current = trimmed.slice(1)
			sections[current] = ''
		} else if (current) {
			sections[current] += `${line}\n`
		}
	}

	const uptimeRaw = sections.uptime?.trim() ?? ''
	// 14:23:01 up 12 days,  3:07,  1 user,  load average: 0.00, 0.01, 0.05
	const loadMatch = uptimeRaw.match(/load average[s]?:\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/)
	const upMatch = uptimeRaw.match(/up\s+(.+?),\s*\d+\s+user/)

	const memLine = sections.mem
		?.split('\n')
		.find((l) => l.trim().startsWith('Mem:'))
		?.trim()
	// Mem:    977  320  200  12  456  590
	const memParts = memLine?.split(/\s+/).slice(1).map(Number) ?? []

	const diskLine = sections.disk?.trim().split('\n').pop()?.trim()
	// /dev/vda1  50G  12G  36G  25% /
	const diskParts = diskLine?.split(/\s+/) ?? []

	return {
		hostname: sections.hostname?.trim() ?? '',
		os: sections.os?.trim() ?? '',
		cpuModel:
			sections.cpu
				?.split('\n')[0]
				?.replace(/model name\s*:\s*/, '')
				.trim() ?? '',
		cpuCores: Number(sections.cores?.trim()) || 0,
		uptime: upMatch?.[1]?.trim() ?? '',
		load: loadMatch
			? [Number(loadMatch[1]), Number(loadMatch[2]), Number(loadMatch[3])]
			: [0, 0, 0],
		mem: {
			totalMb: memParts[0] ?? 0,
			usedMb: memParts[1] ?? 0,
			availableMb: memParts[5] ?? 0,
		},
		disk: {
			size: diskParts[1] ?? '',
			used: diskParts[2] ?? '',
			avail: diskParts[3] ?? '',
			usePercent: Number(diskParts[4]?.replace('%', '')) || 0,
			mount: diskParts[5] ?? '/',
		},
		collectedAt: new Date().toISOString(),
	}
}

const HOST_INFO_COMMAND = [
	'echo @hostname && hostname',
	'echo @os && uname -sr',
	'echo @cpu && grep -m1 "model name" /proc/cpuinfo',
	'echo @cores && nproc',
	'echo @uptime && uptime',
	'echo @mem && free -m',
	'echo @disk && df -h /',
].join(' && ')

export const terminalService = {
	/** 发送 SSH 控制台设备授权验证码（复用通用验证码邮件模板） */
	async sendAccessCode(user: { id: string; email: string; name: string }) {
		const code = Math.floor(100000 + Math.random() * 900000).toString()
		const expiresAt = new Date(Date.now() + CODE_EXPIRES_MS)

		await verificationCodeDal.deleteByTargetAndType(
			user.email,
			VerificationCodeType.TERMINAL_ACCESS,
		)
		await verificationCodeDal.create(
			user.email,
			VerificationCodeType.TERMINAL_ACCESS,
			code,
			expiresAt,
		)

		try {
			await emailService.sendEmail(user.email, {
				TemplateID: EmailTemplate.GENERIC_VERIFICATION,
				TemplateData: {
					name: user.name,
					verificationCode: code,
					title: 'SSH 控制台设备验证',
					reason: '您正在新设备上验证 SSH 控制台访问权限，验证码用于完成设备授权',
				},
				subject: 'Briar - SSH 控制台验证码',
			})
		} catch (error) {
			console.error('Failed to send terminal access code:', error)
			throw new Error('SEND_EMAIL_FAILED')
		}
	},

	/** 校验验证码，签发 7 天有效的设备令牌 */
	async verifyAccessCode(user: { id: string; email: string }, code: string) {
		const record = await verificationCodeDal.findValidByTargetTypeAndCode(
			user.email,
			VerificationCodeType.TERMINAL_ACCESS,
			code,
		)
		if (!record) throw new Error('INVALID_CODE')

		await verificationCodeDal.markAsUsed(record.id)

		const token = jwt.sign(
			{ sub: user.id, purpose: DEVICE_TOKEN_PURPOSE } satisfies DeviceTokenPayload,
			AUTH_CONFIG.jwtSecret,
			{ expiresIn: DEVICE_TOKEN_EXPIRES_IN },
		)
		const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
		return { token, expiresAt }
	},

	/** 校验设备令牌是否有效且属于指定用户 */
	verifyDeviceToken(token: string, userId: string): boolean {
		try {
			const payload = jwt.verify(token, AUTH_CONFIG.jwtSecret) as DeviceTokenPayload
			return payload.purpose === DEVICE_TOKEN_PURPOSE && payload.sub === userId
		} catch {
			return false
		}
	},

	/** 采集服务器信息（内存 / CPU 负载 / 硬盘 / 系统），10s 缓存 */
	async getHostInfo(): Promise<HostInfo> {
		if (hostInfoCache && Date.now() - hostInfoCache.at < HOST_INFO_CACHE_MS) {
			return hostInfoCache.data
		}
		const ssh = await createSshConnection()
		try {
			const raw = await execCommand(ssh, HOST_INFO_COMMAND)
			const data = parseHostInfo(raw)
			hostInfoCache = { data, at: Date.now() }
			return data
		} finally {
			ssh.end()
		}
	},
}
