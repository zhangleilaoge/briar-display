import * as path from 'path'
import * as dnspod from 'tencentcloud-sdk-nodejs-dnspod'
import { findRepoRoot } from './utils'

function getDnsPodClient(): any {
	const secretId = process.env.BRIAR_TX_SEC_ID
	const secretKey = process.env.BRIAR_TX_SEC_KEY

	if (!secretId || !secretKey) {
		throw new Error('Missing BRIAR_TX_SEC_ID or BRIAR_TX_SEC_KEY for Tencent Cloud DNS')
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const Client = (dnspod as any).dnspod.v20210323.Client

	return new Client({
		credential: { secretId, secretKey },
		region: '',
		profile: {
			httpProfile: { endpoint: 'dnspod.tencentcloudapi.com' },
		},
	})
}

function extractRootDomain(fullDomain: string): string {
	const parts = fullDomain.split('.')
	if (parts.length <= 2) {
		return fullDomain
	}
	return parts.slice(-2).join('.')
}

export async function createDnsRecord(
	domain: string,
	recordName: string,
	recordValue: string,
): Promise<number> {
	const rootDomain = extractRootDomain(domain)
	const subDomain = recordName.replace(`.${rootDomain}`, '')

	console.log(`\n📋 添加/更新 DNS TXT 记录: ${recordName} = ${recordValue}`)

	try {
		const client = getDnsPodClient()

		// 域名下无匹配 TXT 记录时 DNSPod 会抛 ResourceNotFound.NoDataOfRecord，按空列表处理
		const listResult = await client
			.DescribeRecordList({
				Domain: rootDomain,
				Subdomain: subDomain,
				RecordType: 'TXT',
			})
			.catch((error: { code?: string }) => {
				if (error?.code === 'ResourceNotFound.NoDataOfRecord') {
					return { RecordList: [] }
				}
				throw error
			})
		const existing = listResult?.RecordList?.find(
			(r: any) => r.Name === subDomain && r.Type === 'TXT',
		)

		if (existing) {
			await client.ModifyRecord({
				Domain: rootDomain,
				RecordId: existing.RecordId,
				SubDomain: subDomain,
				RecordType: 'TXT',
				RecordLine: '默认',
				Value: recordValue,
			})
			console.log(`✅ DNS TXT 记录已更新 (id: ${existing.RecordId})`)
			return Number(existing.RecordId) || 0
		}

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
}

export async function deleteDnsRecord(domain: string, recordId: number | string): Promise<void> {
	if (!recordId) {
		return
	}

	try {
		const rootDomain = extractRootDomain(domain)
		console.log(`🗑️  删除 DNS 记录: ${recordId}`)

		const client = getDnsPodClient()
		await client.DeleteRecord({
			Domain: rootDomain,
			RecordId: Number(recordId),
		})

		console.log('✅ DNS 记录已删除')
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error)
		console.error(`⚠️  删除 DNS 记录失败: ${errorMsg}`)
	}
}
