import { apiClient } from '@/api/request'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import axios from 'axios'
import { useState } from 'react'

export default function ApiTest() {
	const [loading, setLoading] = useState(false)
	const [result, setResult] = useState<any>(null)
	const [error, setError] = useState<string | null>(null)

	const testApi = async (endpoint: string) => {
		setLoading(true)
		setError(null)
		setResult(null)

		try {
			const response = await apiClient.get(endpoint)
			setResult(response.data)
		} catch (err) {
			setError(axios.isAxiosError(err) ? err.message : '请求失败')
		} finally {
			setLoading(false)
		}
	}

	const createUser = async () => {
		setLoading(true)
		setError(null)
		setResult(null)

		try {
			const response = await apiClient.post('/users', {
				name: 'New User',
				email: 'newuser@example.com',
			})
			setResult(response.data)
		} catch (err) {
			setError(axios.isAxiosError(err) ? err.message : '请求失败')
		} finally {
			setLoading(false)
		}
	}

	const endpoints: Array<[string, string]> = [
		['/health', '健康检查'],
		['/info', '服务器信息'],
		['/generate-id', '生成 ID'],
		['/users', '获取用户列表'],
	]

	return (
		<Card className="my-6">
			<CardHeader>
				<span className="rv-label text-[10px] text-muted-foreground">Laboratoire</span>
				<CardTitle>API 测试面板</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="flex flex-wrap gap-2.5">
					{endpoints.map(([endpoint, label]) => (
						<Button
							key={endpoint}
							variant="default"
							onClick={() => testApi(endpoint)}
							disabled={loading}
						>
							{label}
						</Button>
					))}
					<Button onClick={createUser} disabled={loading}>
						创建用户 (POST)
					</Button>
				</div>

				{loading && (
					<div className="rounded-field border border-info/30 bg-info-soft px-4 py-3 text-sm text-info">
						加载中...
					</div>
				)}

				{error && (
					<div className="rounded-field border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
						错误: {error}
					</div>
				)}

				{result && (
					<div>
						<h3 className="mb-2 font-heading text-base font-semibold text-foreground">响应结果</h3>
						{/* 代码块保持朴素 IDE 风格 */}
						<pre className="rv-code overflow-x-auto rounded-md border border-[#e5e7eb] bg-[#fafafa] p-3 text-[12px] text-[#1f2937]">
							{JSON.stringify(result, null, 2)}
						</pre>
					</div>
				)}
			</CardContent>
		</Card>
	)
}
