import { describe, expect, test } from 'bun:test'
import { extractFlashvars, pickMp4List } from './pornhubMediaService'

describe('extractFlashvars', () => {
	test('提取 var flashvars_xxx 后的 JSON（含嵌套对象与字符串内的花括号）', () => {
		const html = [
			'<html><script>',
			'var flashvars_474651895 = {"video_title":"a {not} closed } brace","isVR":false,',
			'"mediaDefinitions":[{"format":"hls","quality":"720","videoUrl":"https://ev-h.phncdn.com/hls/x.m3u8"}],',
			'"nested":{"a":{"b":[1,2,{"c":"\\"quoted\\""}]}}};',
			'var next_var = 1;',
			'</script></html>',
		].join('\n')
		const data = extractFlashvars(html)
		expect(data).not.toBeNull()
		expect(data?.video_title).toBe('a {not} closed } brace')
		expect((data?.nested as { a: { b: { c: string }[] } }).a.b[2].c).toBe('"quoted"')
		expect((data?.mediaDefinitions as { format: string }[])[0].format).toBe('hls')
	})

	test('没有 flashvars 返回 null', () => {
		expect(extractFlashvars('<html><body>oops</body></html>')).toBeNull()
	})

	test('JSON 非法时返回 null 而不是抛异常', () => {
		expect(extractFlashvars('var flashvars_1 = {oops}; var x=1;')).toBeNull()
	})
})

describe('pickMp4List', () => {
	test('按清晰度降序、同档去重、忽略非 mp4 与无效项', () => {
		const list = pickMp4List([
			{ format: 'mp4', quality: '240', videoUrl: 'https://ev.phncdn.com/240.mp4' },
			{ format: 'mp4', quality: '720', videoUrl: 'https://ev.phncdn.com/720.mp4' },
			{ format: 'mp4', quality: '480', videoUrl: 'https://ev.phncdn.com/480.mp4' },
			{ format: 'mp4', quality: '720', videoUrl: 'https://ev.phncdn.com/720-dup.mp4' },
			{ format: 'hls', quality: '1080', videoUrl: 'https://ev-h.phncdn.com/x.m3u8' },
			{ format: 'mp4', quality: '', videoUrl: '' },
			null as never,
		])
		expect(list).toEqual([
			{ quality: 720, url: 'https://ev.phncdn.com/720.mp4' },
			{ quality: 480, url: 'https://ev.phncdn.com/480.mp4' },
			{ quality: 240, url: 'https://ev.phncdn.com/240.mp4' },
		])
	})

	test('quality 缺失时回退 height', () => {
		const list = pickMp4List([
			{ format: 'mp4', height: 1080, videoUrl: 'https://ev.phncdn.com/1080.mp4' },
		])
		expect(list).toEqual([{ quality: 1080, url: 'https://ev.phncdn.com/1080.mp4' }])
	})

	test('空列表返回空', () => {
		expect(pickMp4List([])).toEqual([])
	})
})
