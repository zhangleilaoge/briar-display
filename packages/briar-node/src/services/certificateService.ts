import { createHmac } from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import * as acme from 'acme-client'
import COS from 'cos-nodejs-sdk-v5'
import * as dnspod from 'tencentcloud-sdk-nodejs-dnspod'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * 证书申请和管理服务
 */
export const certificateService = {
	/**
	 * 获取腾讯云云解析 DNSPod 客户端
	 */
	getDnsPodClient(): any {
		const secretId = process.env.BRIAR_TX_SEC_ID
		const secretKey = process.env.BRIAR_TX_SEC_KEY

		if (!secretId || !secretKey) {
			throw new Error('Missing BRIAR_TX_SEC_ID or BRIAR_TX_SEC_KEY for Tencent Cloud DNS')
		}

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const Client = (dnspod as any).dnspod.v20210323.Client

		return new Client({
			credential: {
				secretId,
				secretKey,
			},
			region: '',
			profile: {
				httpProfile: {
					endpoint: 'dnspod.tencentcloudapi.com',
				},
			},
		})
	},

	/**
	 * 从完整域名提取根域名
	 * 例如：_acme-challenge.example.com -> example.com
	 */
	extractRootDomain(fullDomain: string): string {
		const parts = fullDomain.split('.')
		if (parts.length <= 2) {
			return fullDomain
		}
		return parts.slice(-2).join('.')
	},

	/**
	 * 创建 DNS TXT 记录用于 ACME 验证
	 */
	async createDnsRecord(domain: string, recordName: string, recordValue: string): Promise<number> {
		const rootDomain = this.extractRootDomain(domain)
		const subDomain = recordName.replace(`.${rootDomain}`, '')

		console.log(`\n📋 添加 DNS TXT 记录: ${recordName} = ${recordValue}`)

		try {
			const client = this.getDnsPodClient()
			const result = await client.CreateRecord({
				Domain: rootDomain,
				SubDomain: subDomain,
				RecordType: 'TXT',
				RecordLine: '默认',
				Value: recordValue,
			})
			const recordId = result.RecordId
			console.log(`✅ DNS TXT 记录已添加 (id: ${recordId})`)
			return Number(recordId) || 0
		} catch (error) {
			console.error('❌ 添加 DNS 记录失败:', error)
			throw error
		}
	},

	/**
	 * 删除 DNS TXT 记录
	 */
	async deleteDnsRecord(domain: string, recordId: number | string): Promise<void> {
		if (!recordId) {
			return
		}

		try {
			const rootDomain = this.extractRootDomain(domain)
			console.log(`🗑️  删除 DNS 记录: ${recordId}`)

			const client = this.getDnsPodClient()
			await client.DeleteRecord({
				Domain: rootDomain,
				RecordId: Number(recordId),
			})

			console.log('✅ DNS 记录已删除')
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error)
			console.error(`⚠️  删除 DNS 记录失败: ${errorMsg}`)
			// 不抛出错误，因为记录可能已经删除了
		}
	},
	/**
	 * 获取或初始化账户私钥
	 */
	async getOrCreateAccountKey(): Promise<string> {
		// 优先从环境变量读取
		const envKey = process.env.ACME_ACCOUNT_KEY
		if (envKey) {
			// 支持 base64 编码的密钥
			try {
				return Buffer.from(envKey, 'base64').toString('utf-8')
			} catch {
				return envKey // 如果不是 base64，直接返回
			}
		}

		const repoRoot = this.findRepoRoot(process.cwd())
		const accountKeyPath = path.join(repoRoot, '.certificates/account.pem')
		const certDir = path.dirname(accountKeyPath)

		if (!fs.existsSync(certDir)) {
			fs.mkdirSync(certDir, { recursive: true })
		}

		if (fs.existsSync(accountKeyPath)) {
			console.log('从文件读取账户私钥:', accountKeyPath)
			return fs.readFileSync(accountKeyPath, 'utf-8')
		}

		// 如果都没有，生成新的
		console.log('生成新的 ACME 账户私钥...')
		const accountKeyBuffer = await acme.forge.createPrivateKey()
		const accountKey = accountKeyBuffer.toString()
		fs.writeFileSync(accountKeyPath, accountKey, { mode: 0o600 })
		console.log('账户私钥已保存:', accountKeyPath)
		return accountKey
	},

	/**
	 * 获取或初始化服务器私钥
	 */
	async getOrCreateServerKey(): Promise<string> {
		// 优先从环境变量读取
		const envKey = process.env.ACME_SERVER_KEY
		if (envKey) {
			// 支持 base64 编码的密钥
			try {
				return Buffer.from(envKey, 'base64').toString('utf-8')
			} catch {
				return envKey // 如果不是 base64，直接返回
			}
		}

		const repoRoot = this.findRepoRoot(process.cwd())
		const serverKeyPath = path.join(repoRoot, '.certificates/server.pem')
		const certDir = path.dirname(serverKeyPath)

		if (!fs.existsSync(certDir)) {
			fs.mkdirSync(certDir, { recursive: true })
		}

		if (fs.existsSync(serverKeyPath)) {
			console.log('从文件读取服务器私钥:', serverKeyPath)
			return fs.readFileSync(serverKeyPath, 'utf-8')
		}

		// 如果都没有，生成新的
		console.log('生成新的服务器私钥...')
		const serverKeyBuffer = await acme.forge.createPrivateKey()
		const serverKey = serverKeyBuffer.toString()
		fs.writeFileSync(serverKeyPath, serverKey, { mode: 0o600 })
		console.log('服务器私钥已保存:', serverKeyPath)
		return serverKey
	},

	/**
	 * 申请 Let's Encrypt 证书
	 */
	async requestCertificate(domain: string): Promise<{
		cert: string
		key: string
	}> {
		const acmeEmail = process.env.ACME_EMAIL
		if (!acmeEmail) {
			throw new Error('Missing ACME_EMAIL environment variable')
		}

		const acmeDirectoryUrl =
			process.env.ACME_DIRECTORY_URL || 'https://acme-v02.api.letsencrypt.org/directory'

		const accountKey = await this.getOrCreateAccountKey()
		const serverKey = await this.getOrCreateServerKey()

		console.log(`\n申请证书: ${domain}`)
		console.log(`ACME 服务器: ${acmeDirectoryUrl}`)
		console.log(`Email: ${acmeEmail}\n`)

		try {
			// 1. 初始化 ACME 客户端
			const client = new acme.Client({
				directoryUrl: acmeDirectoryUrl,
				accountKey: accountKey,
			})

			// 2. 获取或创建账户
			console.log('正在注册/获取 ACME 账户...')
			const account = await client.createAccount({
				termsOfServiceAgreed: true,
				contact: [`mailto:${acmeEmail}`],
			})
			console.log('账户创建/获取成功\n')

			// 3. 创建订单
			console.log('正在创建证书订单...')
			const order = await client.createOrder({
				identifiers: [
					{
						type: 'dns',
						value: domain,
					},
				],
			})
			console.log('订单创建完成\n')

			// 4. 处理验证
			console.log('正在处理 DNS 验证...')
			const authorizations = await client.getAuthorizations(order)
			const challenges = await Promise.all(
				authorizations.map(async (authz) => {
					const challenge = authz.challenges.find((c) => c.type === 'dns-01')
					if (!challenge) {
						throw new Error(`未找到 dns-01 challenge for ${authz.identifier.value}`)
					}
					const keyAuthorization = await client.getChallengeKeyAuthorization(challenge)
					// 使用 crypto 方法计算 DNS 记录值（base64url 编码的 sha256）
					const crypto = await import('crypto')
					const digest = crypto.createHash('sha256').update(keyAuthorization).digest()
					const dnsRecord = Buffer.from(digest)
						.toString('base64')
						.replace(/\+/g, '-')
						.replace(/\//g, '_')
						.replace(/=/g, '')
					console.log(`DNS 记录值 (_acme-challenge.${authz.identifier.value}): ${dnsRecord}`)

					// 自动更新 DNS 记录
					const recordId = await this.createDnsRecord(
						authz.identifier.value,
						`_acme-challenge.${authz.identifier.value}`,
						dnsRecord,
					)

					return { authz, challenge, keyAuthorization, recordId, dnsRecord }
				}),
			)

			// 等待 DNS 传播
			console.log('\n⏰ 等待 DNS 生效...')
			console.log('⚠️  请立即在上面的 DNSPod 控制台中添加 TXT 记录，然后回来')
			console.log('📤 将在 60 秒后继续进行 DNS 验证...')
			console.log('💡 如果 DNS 还未生效，验证可能会失败。可以 Ctrl+C 中断并重新运行')

			await new Promise((resolve) => setTimeout(resolve, 60000))

			// 验证挑战
			console.log('正在验证挑战...')
			await Promise.all(challenges.map((c) => client.completeChallenge(c.challenge)))
			console.log('挑战已提交，等待 ACME 服务器验证...\n')

			// 等待订单准备就绪
			console.log('等待订单验证完成...')
			await client.waitForValidStatus(order)
			console.log('✅ 订单验证成功\n')

			// 清理 DNS 记录
			console.log('ℹ️  DNS 验证已完成，无需手动删除 DNS 记录（保留不影响）')

			// 5. 最终化订单并获取证书
			console.log('正在最终化订单...')
			const finalizedOrder = await client.finalizeOrder(order, serverKey)
			console.log('订单最终化完成\n')

			console.log('正在获取证书...')
			const cert = await client.getCertificate(finalizedOrder)
			console.log('✅ 证书申请成功\n')

			return {
				cert: cert,
				key: serverKey,
			}
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error)
			console.error(`❌ ACME 证书申请失败: ${errorMsg}\n`)
			throw error
		}
	},

	/**
	 * 保存证书到 briar-assets 目录
	 */
	async saveCertificates(
		cert: string,
		key: string,
		domain: string,
	): Promise<{ certPath: string; keyPath: string }> {
		const repoRoot = this.findRepoRoot(process.cwd())
		const sslDir = path.join(repoRoot, 'briar-assets/ssl')

		// 确保目录存在
		if (!fs.existsSync(sslDir)) {
			fs.mkdirSync(sslDir, { recursive: true })
		}

		const certFilename = `${domain}_bundle.crt`
		const keyFilename = `${domain}.key`

		const certPath = path.join(sslDir, certFilename)
		const keyPath = path.join(sslDir, keyFilename)

		// 之前的证书备份
		if (fs.existsSync(certPath)) {
			const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
			fs.copyFileSync(certPath, `${certPath}.backup.${timestamp}`)
		}
		if (fs.existsSync(keyPath)) {
			const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
			fs.copyFileSync(keyPath, `${keyPath}.backup.${timestamp}`)
		}

		// 写入新的证书
		fs.writeFileSync(certPath, cert, { mode: 0o644 })
		fs.writeFileSync(keyPath, key, { mode: 0o600 })

		console.log(`证书已保存: ${certPath}`)
		console.log(`密钥已保存: ${keyPath}`)

		return { certPath, keyPath }
	},

	/**
	 * 上传证书到 CDN (COS)
	 */
	async uploadCertificatesToCDN(domain: string): Promise<{ certUrl: string; keyUrl: string }> {
		const region = process.env.BRIAR_TX_BUCKET_REGION
		const secretId = process.env.BRIAR_TX_SEC_ID
		const secretKey = process.env.BRIAR_TX_SEC_KEY
		const bucket = process.env.BRIAR_TX_BUCKET_NAME

		if (!region || !secretId || !secretKey || !bucket) {
			throw new Error(
				'Missing COS env vars: BRIAR_TX_BUCKET_REGION, BRIAR_TX_SEC_ID, BRIAR_TX_SEC_KEY, BRIAR_TX_BUCKET_NAME',
			)
		}

		const repoRoot = this.findRepoRoot(process.cwd())
		const sslDir = path.join(repoRoot, 'briar-assets/ssl')

		const certFilename = `${domain}_bundle.crt`
		const keyFilename = `${domain}.key`
		const certPath = path.join(sslDir, certFilename)
		const keyPath = path.join(sslDir, keyFilename)

		if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
			throw new Error(`证书文件不存在: ${certPath} 或 ${keyPath}`)
		}

		const cos = new COS({
			SecretId: secretId,
			SecretKey: secretKey,
		})

		const uploadFile = (filePath: string, fileName: string, retries = 3): Promise<string> =>
			new Promise((resolve, reject) => {
				const cosKey = `certificates/${fileName}`

				cos.putObject(
					{
						Bucket: bucket,
						Region: region,
						Key: cosKey,
						StorageClass: 'STANDARD',
						Body: fs.createReadStream(filePath),
					},
					(err, data) => {
						if (err) {
							if (retries > 0) {
								console.log(`重试上传 ${filePath} (剩余 ${retries} 次) ...`)
								setTimeout(() => {
									uploadFile(filePath, fileName, retries - 1)
										.then(resolve)
										.catch(reject)
								}, 3000)
								return
							}
							reject(err)
							return
						}

						if (data?.statusCode === 200) {
							const url = `https://${bucket}.cos.${region}.myqcloud.com/${cosKey}`
							console.log(`上传成功: ${url}`)
							resolve(url)
						} else {
							reject(new Error(`上传失败: ${data?.statusCode}`))
						}
					},
				)
			})

		const [certUrl, keyUrl] = await Promise.all([
			uploadFile(certPath, certFilename),
			uploadFile(keyPath, keyFilename),
		])

		return { certUrl, keyUrl }
	},

	/**
	 * 检查证书是否需要续期
	 */
	async shouldRenew(domain: string): Promise<boolean> {
		const repoRoot = this.findRepoRoot(process.cwd())
		const certPath = path.join(repoRoot, 'briar-assets/ssl', `${domain}_bundle.crt`)

		if (!fs.existsSync(certPath)) {
			console.log('证书文件不存在，需要申请新证书')
			return true
		}

		try {
			const { execSync } = await import('child_process')
			const output = execSync(`openssl x509 -in "${certPath}" -noout -enddate`, {
				encoding: 'utf-8',
			})
			const match = output.match(/notAfter=(.+)/)
			if (!match) {
				console.warn('无法解析证书过期时间')
				return true
			}

			const expiryDate = new Date(match[1])
			const now = new Date()
			const daysUntilExpiry = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)

			console.log(`证书过期时间: ${expiryDate.toISOString()}`)
			console.log(`距离过期还有 ${Math.floor(daysUntilExpiry)} 天`)

			if (daysUntilExpiry <= 30) {
				console.log('证书将在 30 天内过期，需要续期')
				return true
			}

			return false
		} catch (error) {
			console.error('检查证书过期时间失败:', error)
			return true
		}
	},

	/**
	 * 提交证书到 briar-assets 子模块并推送
	 */
	async commitAndPushAssets(domain: string): Promise<void> {
		const { execSync } = await import('child_process')
		const repoRoot = this.findRepoRoot(process.cwd())
		const assetsDir = path.join(repoRoot, 'briar-assets')

		console.log('\n📦 提交证书到 briar-assets...')

		try {
			// 配置 git 用户信息
			try {
				execSync('git config user.email', { cwd: assetsDir, stdio: 'pipe' })
			} catch {
				execSync('git config user.email "certbot@briar.dev"', { cwd: assetsDir })
				execSync('git config user.name "Briar CertBot"', { cwd: assetsDir })
			}

			execSync('git add ssl/', { cwd: assetsDir })
			execSync(`git commit -m "chore: update SSL certificates for ${domain}"`, { cwd: assetsDir })
			execSync('git push origin main', { cwd: assetsDir })
			console.log('✅ briar-assets 已提交并推送')
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error)
			console.error('❌ briar-assets 提交失败:', msg)
			throw error
		}
	},

	/**
	 * 更新主仓库的子模块引用并推送
	 */
	async updateMainRepoSubmodule(): Promise<void> {
		const { execSync } = await import('child_process')
		const repoRoot = this.findRepoRoot(process.cwd())

		console.log('\n📦 更新主仓库子模块引用...')

		try {
			// 配置 git 用户信息
			try {
				execSync('git config user.email', { cwd: repoRoot, stdio: 'pipe' })
			} catch {
				execSync('git config user.email "certbot@briar.dev"', { cwd: repoRoot })
				execSync('git config user.name "Briar CertBot"', { cwd: repoRoot })
			}

			execSync('git add briar-assets', { cwd: repoRoot })
			execSync('git commit -m "chore: update briar-assets submodule (certificates)"', {
				cwd: repoRoot,
			})
			execSync('git push origin master', { cwd: repoRoot })
			console.log('✅ 主仓库子模块已更新')
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error)
			console.error('❌ 主仓库子模块更新失败:', msg)
			throw error
		}
	},

	/**
	 * 部署 Nginx 配置（同步证书并重载）
	 */
	async deployNginx(): Promise<void> {
		const { execSync } = await import('child_process')
		const repoRoot = this.findRepoRoot(process.cwd())

		console.log('\n🚀 部署 Nginx 配置...')

		try {
			execSync('./scripts/deploy-nginx.sh', { cwd: repoRoot, stdio: 'inherit' })
			console.log('✅ Nginx 已重载')
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error)
			console.error('❌ Nginx 部署失败:', msg)
			throw error
		}
	},

	/**
	 * 完整的证书更新流程
	 */
	async renewCertificate(domain: string): Promise<{
		success: boolean
		skipped?: boolean
		certPath?: string
		keyPath?: string
		cdnUrls?: { certUrl: string; keyUrl: string }
		error?: string
	}> {
		try {
			console.log(`\n${'='.repeat(60)}`)
			console.log(`🔍 检查证书续期状态: ${domain}`)
			console.log(`${'='.repeat(60)}\n`)

			// 1. 检查是否需要续期
			const needsRenew = await this.shouldRenew(domain)
			if (!needsRenew) {
				console.log('✅ 证书尚未到期，无需续期')
				return { success: true, skipped: true }
			}

			// 2. 申请证书
			const { cert, key } = await this.requestCertificate(domain)

			// 3. 保存到本地
			const { certPath, keyPath } = await this.saveCertificates(
				cert,
				key,
				domain.replace(/\*/g, 'wildcard'),
			)

			// 4. 上传到 CDN
			const cdnUrls = await this.uploadCertificatesToCDN(domain.replace(/\*/g, 'wildcard'))

			// 5. 提交到 briar-assets
			await this.commitAndPushAssets(domain)

			// 6. 更新主仓库子模块
			await this.updateMainRepoSubmodule()

			// 7. 部署 Nginx
			await this.deployNginx()

			console.log(`\n${'='.repeat(60)}`)
			console.log('✅ 证书续期流程全部完成')
			console.log(`${'='.repeat(60)}\n`)

			return {
				success: true,
				certPath,
				keyPath,
				cdnUrls,
			}
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error)
			console.error(`\n❌ 证书续期失败: ${errorMsg}\n`)
			return {
				success: false,
				error: errorMsg,
			}
		}
	},

	/**
	 * 查找项目根目录
	 */
	findRepoRoot(startDir: string): string {
		let currentDir = startDir
		while (true) {
			if (fs.existsSync(path.join(currentDir, 'bun.lock'))) {
				return currentDir
			}
			const parentDir = path.dirname(currentDir)
			if (parentDir === currentDir) {
				return startDir
			}
			currentDir = parentDir
		}
	},
}
