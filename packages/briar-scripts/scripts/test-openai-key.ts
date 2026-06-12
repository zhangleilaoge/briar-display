import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import OpenAI from 'openai'

// 找到仓库根目录
const findRepoRoot = (startDir: string) => {
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
}

const repoRoot = findRepoRoot(process.cwd())
dotenv.config({ path: path.join(repoRoot, '.env') })

async function testOpenAIKey() {
	const apiKey = process.argv[2] || process.env.OPENAI_API_KEY

	if (!apiKey) {
		console.error('请提供 OpenAI API Key 作为参数，或设置 OPENAI_API_KEY 环境变量')
		process.exit(1)
	}

	console.log(`测试 API Key: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}`)

	const openai = new OpenAI({ apiKey })

	try {
		// 测试 1: 获取模型列表
		console.log('\n1. 测试获取模型列表...')
		const models = await openai.models.list()
		const modelList = []
		for await (const model of models) {
			modelList.push(model.id)
			if (modelList.length >= 5) break // 只获取前5个
		}
		console.log('✅ 模型列表获取成功')
		console.log('可用模型示例:', modelList.join(', '))

		// 测试 2: 简单的聊天完成
		console.log('\n2. 测试聊天完成...')
		const completion = await openai.chat.completions.create({
			model: 'gpt-3.5-turbo',
			messages: [{ role: 'user', content: '你好，请用一句话介绍你自己。' }],
			max_tokens: 100,
		})

		const response = completion.choices[0]?.message?.content
		console.log('✅ 聊天完成成功')
		console.log('响应:', response)

		// 测试 3: 检查使用情况（如果支持）
		console.log('\n3. 测试检查使用情况...')
		try {
			// 注意：这个端点可能需要特定权限
			const usage = await openai.models.retrieve('gpt-3.5-turbo')
			console.log('✅ 模型信息获取成功')
			console.log('模型ID:', usage.id)
			console.log('所有者:', usage.owned_by)
		} catch (error: any) {
			console.log('⚠️  使用情况检查跳过（可能需要更高权限）:', error.message)
		}

		console.log('\n🎉 所有测试通过！API Key 可以正常使用。')
		return true
	} catch (error: any) {
		console.error('\n❌ 测试失败:', error.message)

		if (error.status === 401) {
			console.error('错误原因: API Key 无效或已过期')
		} else if (error.status === 429) {
			console.error('错误原因: 请求过于频繁或配额不足')
		} else if (error.status === 500) {
			console.error('错误原因: OpenAI 服务器错误')
		}

		return false
	}
}

// 运行测试
testOpenAIKey()
	.then((success) => {
		process.exit(success ? 0 : 1)
	})
	.catch((error) => {
		console.error('脚本执行错误:', error)
		process.exit(1)
	})
