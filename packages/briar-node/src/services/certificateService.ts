import { X509Certificate } from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import * as tls from 'tls'
import * as acme from 'acme-client'
import COS from 'cos-nodejs-sdk-v5'
import { type CertRenewalTrigger, certRenewalDal } from '../dal/certRenewalDal'
import { createDnsRecord, deleteDnsRecord } from './certificate/dnsService'
import { getOrCreateAccountKey, getOrCreateServerKey } from './certificate/keyService'
import { findRepoRoot } from './certificate/utils'

export interface CertInfo {
	commonName: string
	issuer: string
	notBefore: string
	notAfter: string
	daysRemaining: number
}

/** 从 X509 subject/issuer 字符串中提取 CN */
const extractCN = (value: string): string => {
	const match = value.match(/CN=([^\n,]+)/)
	return match ? match[1].trim() : value
}

const buildCertInfo = (
	commonName: string,
	issuer: string,
	notBefore: string,
	notAfter: string,
): CertInfo => ({
	commonName,
	issuer,
	notBefore: new Date(notBefore).toISOString(),
	notAfter: new Date(notAfter).toISOString(),
	daysRemaining: Math.floor((new Date(notAfter).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
})

/** tls.getPeerCertificate 的字段可能是 string[]，统一取首个 */
const first = (value: string | string[] | undefined): string | undefined =>
	Array.isArray(value) ? value[0] : value

/**
 * 证书申请和管理服务
 */
export const certificateService = {
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

		const accountKey = await getOrCreateAccountKey()
		const serverKey = await getOrCreateServerKey()

		console.log(`\n申请证书: ${domain}`)
		console.log(`ACME 服务器: ${acmeDirectoryUrl}`)
		console.log(`Email: ${acmeEmail}\n`)

		let challenges: Array<{
			authz: any
			challenge: any
			keyAuthorization: string
			recordId: number
			dnsRecord: string
		}> = []

		try {
			const client = new acme.Client({
				directoryUrl: acmeDirectoryUrl,
				accountKey: accountKey,
				backoffAttempts: 10,
				backoffMin: 5000,
				backoffMax: 30000,
			})

			console.log('正在注册/获取 ACME 账户...')
			const account = await client.createAccount({
				termsOfServiceAgreed: true,
				contact: [`mailto:${acmeEmail}`],
			})
			console.log('账户创建/获取成功\n')

			console.log('正在创建证书订单...')
			const order = await client.createOrder({
				identifiers: [{ type: 'dns', value: domain }],
			})
			console.log('订单创建完成\n')

			console.log('正在处理 DNS 验证...')
			const authorizations = await client.getAuthorizations(order)
			challenges = await Promise.all(
				authorizations.map(async (authz) => {
					const challenge = authz.challenges.find((c) => c.type === 'dns-01')
					if (!challenge) {
						throw new Error(`未找到 dns-01 challenge for ${authz.identifier.value}`)
					}
					const keyAuthorization = await client.getChallengeKeyAuthorization(challenge)
					const dnsRecord = keyAuthorization
					console.log(`DNS 记录值 (_acme-challenge.${authz.identifier.value}): ${dnsRecord}`)

					const recordId = await createDnsRecord(
						authz.identifier.value,
						`_acme-challenge.${authz.identifier.value}`,
						dnsRecord,
					)

					return { authz, challenge, keyAuthorization, recordId, dnsRecord }
				}),
			)

			console.log('\n⏰ 等待 DNS 生效...')
			console.log('⚠️  请立即在上面的 DNSPod 控制台中添加 TXT 记录，然后回来')
			console.log('📤 将在 60 秒后继续进行 DNS 验证...')
			console.log('💡 如果 DNS 还未生效，验证可能会失败。可以 Ctrl+C 中断并重新运行')

			await new Promise((resolve) => setTimeout(resolve, 180000))

			console.log('正在验证挑战...')
			await Promise.all(challenges.map((c) => client.completeChallenge(c.challenge)))
			console.log('挑战已提交，等待 ACME 服务器验证...\n')

			console.log('等待订单验证完成...')
			await Promise.race([
				client.waitForValidStatus(order),
				new Promise((_, reject) =>
					setTimeout(() => reject(new Error('ACME validation timed out after 120s')), 120000),
				),
			])
			console.log('✅ 订单验证成功\n')

			console.log('ℹ️  DNS 验证已完成，无需手动删除 DNS 记录（保留不影响）')

			console.log('正在生成证书签名请求 (CSR)...')
			const [, csr] = await acme.forge.createCsr({ altNames: [domain] }, Buffer.from(serverKey))
			console.log('CSR 生成完成\n')

			console.log('正在最终化订单...')
			const finalizedOrder = await client.finalizeOrder(order, csr)
			console.log('订单最终化完成\n')

			console.log('正在获取证书...')
			const cert = await client.getCertificate(finalizedOrder)
			console.log('✅ 证书申请成功\n')

			return { cert, key: serverKey }
		} catch (error) {
			console.error('❌ ACME 证书申请失败')
			if (error && typeof error === 'object') {
				console.error('错误详情:', JSON.stringify(error, null, 2))
			} else {
				console.error('错误:', error)
			}
			throw error
		} finally {
			if (challenges.length > 0) {
				console.log('\n🧹 清理 DNS TXT 记录...')
				for (const c of challenges) {
					if (c.recordId) {
						try {
							await deleteDnsRecord(c.authz.identifier.value, c.recordId)
						} catch {
							// 忽略清理错误
						}
					}
				}
			}
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
		const repoRoot = findRepoRoot(process.cwd())
		const sslDir = path.join(repoRoot, 'briar-assets/ssl')

		if (!fs.existsSync(sslDir)) {
			fs.mkdirSync(sslDir, { recursive: true })
		}

		const certFilename = `${domain}_bundle.crt`
		const keyFilename = `${domain}.key`

		const certPath = path.join(sslDir, certFilename)
		const keyPath = path.join(sslDir, keyFilename)

		if (fs.existsSync(certPath)) {
			const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
			fs.copyFileSync(certPath, `${certPath}.backup.${timestamp}`)
		}
		if (fs.existsSync(keyPath)) {
			const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
			fs.copyFileSync(keyPath, `${keyPath}.backup.${timestamp}`)
		}

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

		const repoRoot = findRepoRoot(process.cwd())
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
	 * 读取本地证书文件信息（briar-assets/ssl 下即将部署的证书）
	 */
	async getLocalCertificateInfo(domain: string): Promise<CertInfo | null> {
		const repoRoot = findRepoRoot(process.cwd())
		const certPath = path.join(repoRoot, 'briar-assets/ssl', `${domain}_bundle.crt`)

		if (!fs.existsSync(certPath)) {
			return null
		}

		try {
			const x509 = new X509Certificate(fs.readFileSync(certPath, 'utf-8'))
			return buildCertInfo(
				extractCN(x509.subject),
				extractCN(x509.issuer),
				x509.validFrom,
				x509.validTo,
			)
		} catch (error) {
			console.error('解析本地证书失败:', error)
			return null
		}
	},

	/**
	 * 通过 TLS 握手探测线上实际服役的证书
	 */
	async getLiveCertificateInfo(domain: string): Promise<CertInfo | null> {
		return new Promise((resolve) => {
			const socket = tls.connect(
				{ host: domain, port: 443, servername: domain, rejectUnauthorized: false, timeout: 8000 },
				() => {
					const cert = socket.getPeerCertificate()
					socket.end()
					if (!cert || !cert.valid_to) {
						resolve(null)
						return
					}
					resolve(
						buildCertInfo(
							first(cert.subject?.CN) || domain,
							first(cert.issuer?.CN) || first(cert.issuer?.O) || '',
							cert.valid_from,
							cert.valid_to,
						),
					)
				},
			)
			socket.on('timeout', () => {
				socket.destroy()
				resolve(null)
			})
			socket.on('error', (error) => {
				console.error('探测线上证书失败:', error.message)
				resolve(null)
			})
		})
	},

	/**
	 * 检查证书是否需要续期
	 */
	async shouldRenew(domain: string): Promise<boolean> {
		const repoRoot = findRepoRoot(process.cwd())
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
		const repoRoot = findRepoRoot(process.cwd())
		const assetsDir = path.join(repoRoot, 'briar-assets')

		console.log('\n📦 提交证书到 briar-assets...')

		try {
			try {
				execSync('git config user.email', { cwd: assetsDir, stdio: 'pipe' })
			} catch {
				execSync('git config user.email "certbot@briar.dev"', { cwd: assetsDir })
				execSync('git config user.name "Briar CertBot"', { cwd: assetsDir })
			}

			execSync('git add ssl/', { cwd: assetsDir })
			execSync(`git commit -m "chore: update SSL certificates for ${domain} [skip ci]"`, {
				cwd: assetsDir,
			})
			// 子模块通常是 detached HEAD 且落后于远端：
			// 先本地提交，再 merge 远端最新（-X ours：同一证书文件冲突时以本次新签发的为准），
			// 不用 rebase——rebase 冲突会中途卡死，残留带冲突标记的文件流入后续部署步骤
			execSync('git fetch origin', { cwd: assetsDir })
			try {
				execSync('git merge --no-edit -X ours origin/main', { cwd: assetsDir })
			} catch (mergeError) {
				try {
					execSync('git merge --abort', { cwd: assetsDir })
				} catch {
					// 无 merge 现场可清理（如 merge 未开始即失败）
				}
				throw mergeError
			}
			execSync('git push origin HEAD:main', { cwd: assetsDir })
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
		const repoRoot = findRepoRoot(process.cwd())

		console.log('\n📦 更新主仓库子模块引用...')

		try {
			try {
				execSync('git config user.email', { cwd: repoRoot, stdio: 'pipe' })
			} catch {
				execSync('git config user.email "certbot@briar.dev"', { cwd: repoRoot })
				execSync('git config user.name "Briar CertBot"', { cwd: repoRoot })
			}

			execSync('git add briar-assets', { cwd: repoRoot })
			execSync('git commit -m "chore: update briar-assets submodule (certificates) [skip ci]"', {
				cwd: repoRoot,
			})
			// 先本地提交，再 merge 远端最新（-X ours：gitlink 冲突以本次更新为准），
			// 不用 rebase——rebase 冲突会中途卡死残留现场
			execSync('git fetch origin', { cwd: repoRoot })
			try {
				execSync('git merge --no-edit -X ours origin/master', { cwd: repoRoot })
			} catch (mergeError) {
				try {
					execSync('git merge --abort', { cwd: repoRoot })
				} catch {
					// 无 merge 现场可清理（如 merge 未开始即失败）
				}
				throw mergeError
			}
			execSync('git push origin HEAD:master', { cwd: repoRoot })
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
		const repoRoot = findRepoRoot(process.cwd())

		console.log('\n🚀 部署 Nginx 配置...')

		try {
			// 捕获脚本输出再落日志：Bree worker 里 stdio:'inherit' 的输出会丢失，
			// 失败时只剩一句 "Command failed"，无法定位脚本内具体失败步骤
			const output = execSync('./scripts/deploy-nginx.sh', { cwd: repoRoot, encoding: 'utf-8' })
			if (output.trim()) console.log(output.trim())
			console.log('✅ Nginx 已重载')
		} catch (error) {
			const e = error as { stdout?: string; stderr?: string; message?: string }
			if (e.stdout?.trim()) console.error(`deploy-nginx stdout:\n${e.stdout.trim()}`)
			if (e.stderr?.trim()) console.error(`deploy-nginx stderr:\n${e.stderr.trim()}`)
			// 把脚本末尾输出拼进错误信息，随运行记录落库，管理后台可直接看到失败原因
			const lines = (e.stderr || e.stdout || '').trim().split('\n').filter(Boolean)
			const detail = lines.slice(-2).join(' | ')
			const msg = detail ? `${e.message}: ${detail}` : e.message || String(error)
			console.error('❌ Nginx 部署失败:', msg)
			throw new Error(msg)
		}
	},

	/**
	 * 完整的证书更新流程
	 */
	async renewCertificate(
		domain: string,
		force = false,
		triggerType: CertRenewalTrigger = 'manual',
	): Promise<{
		success: boolean
		skipped?: boolean
		certPath?: string
		keyPath?: string
		cdnUrls?: { certUrl: string; keyUrl: string }
		error?: string
	}> {
		// 落库记录续期过程，写库失败不影响续期主流程
		let logId: string | null = null
		try {
			logId = await certRenewalDal.create(domain, triggerType)
		} catch (e) {
			console.error('写入续期记录失败（不影响续期流程）:', e)
		}
		const finishLog = (status: 'success' | 'skipped' | 'failed', message?: string) => {
			if (!logId) return
			certRenewalDal
				.finish(logId, status, message)
				.catch((e) => console.error('更新续期记录失败:', e))
		}

		try {
			console.log(`\n${'='.repeat(60)}`)
			console.log(`🔍 检查证书续期状态: ${domain}`)
			console.log(`${'='.repeat(60)}\n`)

			if (!force) {
				const needsRenew = await this.shouldRenew(domain)
				if (!needsRenew) {
					console.log('✅ 证书尚未到期，无需续期')
					finishLog('skipped', '证书尚未到期，无需续期')
					return { success: true, skipped: true }
				}
			} else {
				console.log('⚡ 强制续期模式，跳过到期检查')
			}

			const { cert, key } = await this.requestCertificate(domain)

			const { certPath, keyPath } = await this.saveCertificates(
				cert,
				key,
				domain.replace(/\*/g, 'wildcard'),
			)

			const cdnUrls = await this.uploadCertificatesToCDN(domain.replace(/\*/g, 'wildcard'))

			// git 同步失败不阻断本地 nginx 部署——证书文件已在服务器上，优先保证服务不中断
			let gitError: string | null = null
			try {
				await this.commitAndPushAssets(domain)
				await this.updateMainRepoSubmodule()
			} catch (error) {
				gitError = error instanceof Error ? error.message : String(error)
				console.error(`\n⚠️  git 同步失败（继续部署 nginx）: ${gitError}\n`)
			}

			await this.deployNginx()

			if (gitError) {
				throw new Error(`证书已部署到 nginx，但 git 同步失败: ${gitError}`)
			}

			console.log(`\n${'='.repeat(60)}`)
			console.log('✅ 证书续期流程全部完成')
			console.log(`${'='.repeat(60)}\n`)

			finishLog('success', '证书续期流程全部完成')
			return {
				success: true,
				certPath,
				keyPath,
				cdnUrls,
			}
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error)
			console.error(`\n❌ 证书续期失败: ${errorMsg}\n`)
			finishLog('failed', errorMsg)
			return {
				success: false,
				error: errorMsg,
			}
		}
	},
}
