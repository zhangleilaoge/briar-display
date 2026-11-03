import { expect, test } from 'bun:test'
import { apiClient } from './request'
import { putPreference } from './users'

test('布尔偏好按 JSON 请求体发送', async () => {
	const previousAdapter = apiClient.defaults.adapter
	let body: unknown
	let contentType: unknown
	apiClient.defaults.adapter = async (config) => {
		body = config.data
		contentType = config.headers.getContentType()
		return {
			data: { success: true, data: { key: 'ribbon-locked', value: true } },
			status: 200,
			statusText: 'OK',
			headers: {},
			config,
		}
	}

	try {
		const response = await putPreference('ribbon-locked', true)
		expect(response.success).toBe(true)
		expect(body).toBe('true')
		expect(contentType).toBe('application/json')
	} finally {
		apiClient.defaults.adapter = previousAdapter
	}
})
