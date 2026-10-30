import { describe, expect, it } from 'bun:test'
import { getFileTypeIconPath } from './fileTypeIconPath'

const ROOT = '/briar/file-icons'

describe('文件类型 SVG 图标', () => {
	it('覆盖常见文档、媒体、压缩包和代码格式', () => {
		const cases = [
			['报告.pdf', 'pdf.svg'],
			['报告.DOCX', 'word.svg'],
			['数据.xlsx', 'table.svg'],
			['介绍.pptx', 'powerpoint.svg'],
			['备份.7z', 'zip.svg'],
			['音乐.mp3', 'audio.svg'],
			['视频.mp4', 'video.svg'],
			['图片.png', 'image.svg'],
			['脚本.py', 'python.svg'],
			['组件.tsx', 'react_ts.svg'],
			['字体.ttf', 'font.svg'],
			['程序.exe', 'exe.svg'],
		]
		for (const [fileName, icon] of cases) {
			expect(getFileTypeIconPath(fileName)).toBe(`${ROOT}/${icon}`)
		}
	})

	it('优先匹配特殊文件名和复合后缀', () => {
		expect(getFileTypeIconPath('package.json')).toBe(`${ROOT}/nodejs.svg`)
		expect(getFileTypeIconPath('.gitignore')).toBe(`${ROOT}/git.svg`)
		expect(getFileTypeIconPath('types.d.ts')).toBe(`${ROOT}/typescript-def.svg`)
		expect(getFileTypeIconPath('api.schema.json')).toBe(`${ROOT}/json_schema.svg`)
		expect(getFileTypeIconPath('syntax.yaml-tmlanguage')).toBe(`${ROOT}/yaml.svg`)
	})

	it('保留 MIME 类型兜底', () => {
		const cases = [
			['unknown.custom', 'application/pdf', 'pdf.svg'],
			['unknown.custom', 'application/json; charset=utf-8', 'json.svg'],
			['unknown.custom', 'audio/mpeg', 'audio.svg'],
			['unknown.custom', 'video/mp4', 'video.svg'],
			['unknown.custom', 'image/png', 'image.svg'],
			['unknown.custom', 'text/plain', 'document.svg'],
		]
		for (const [fileName, mimeType, icon] of cases) {
			expect(getFileTypeIconPath(fileName, mimeType)).toBe(`${ROOT}/${icon}`)
		}
	})

	it('未知、无后缀和空文件名使用默认图标', () => {
		for (const fileName of ['AzerothSurvivors 2026-10-30.save', 'unknownfile', 'file.', '']) {
			expect(getFileTypeIconPath(fileName, 'application/octet-stream')).toBe(`${ROOT}/file.svg`)
		}
	})
})
