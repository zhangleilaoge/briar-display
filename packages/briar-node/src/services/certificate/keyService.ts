import * as fs from 'fs'
import * as path from 'path'
import * as acme from 'acme-client'
import { findRepoRoot } from './utils'

function resolveKeyPath(filename: string): string {
	const repoRoot = findRepoRoot(process.cwd())
	return path.join(repoRoot, '.certificates', filename)
}

function readKeyFromEnv(envName: string): string | undefined {
	const envKey = process.env[envName]
	if (!envKey) return undefined
	try {
		return Buffer.from(envKey, 'base64').toString('utf-8')
	} catch {
		return envKey
	}
}

async function loadOrCreateKey(filename: string, envName: string): Promise<string> {
	const fromEnv = readKeyFromEnv(envName)
	if (fromEnv) return fromEnv

	const keyPath = resolveKeyPath(filename)
	const certDir = path.dirname(keyPath)

	if (!fs.existsSync(certDir)) {
		fs.mkdirSync(certDir, { recursive: true })
	}

	if (fs.existsSync(keyPath)) {
		console.log(`从文件读取私钥: ${keyPath}`)
		return fs.readFileSync(keyPath, 'utf-8')
	}

	console.log('生成新的私钥...')
	const keyBuffer = await acme.forge.createPrivateKey()
	const key = keyBuffer.toString()
	fs.writeFileSync(keyPath, key, { mode: 0o600 })
	console.log(`私钥已保存: ${keyPath}`)
	return key
}

export async function getOrCreateAccountKey(): Promise<string> {
	return loadOrCreateKey('account.pem', 'ACME_ACCOUNT_KEY')
}

export async function getOrCreateServerKey(): Promise<string> {
	return loadOrCreateKey('server.pem', 'ACME_SERVER_KEY')
}
