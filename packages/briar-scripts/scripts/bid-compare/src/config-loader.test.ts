import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs'
import path from 'node:path'
import { loadConfig, mergeWithCliArgs, setPythonPathEnv } from './config-loader.ts'

describe('loadConfig', () => {
	const tmpDir = `/tmp/bid-compare-config-test-${Date.now()}`

	beforeEach(() => {
		fs.mkdirSync(tmpDir, { recursive: true })
	})

	afterEach(() => {
		fs.rmSync(tmpDir, { recursive: true, force: true })
		process.env.PYTHON_PATH = undefined
	})

	it('没有配置文件时返回默认配置', () => {
		const cfg = loadConfig(tmpDir)
		expect(cfg.output).toBe(path.join(tmpDir, 'bid_compare_result'))
		expect(cfg.imgThreshold).toBe(0.7)
		expect(cfg.textThreshold).toBe(0.5)
		expect(cfg.tableThreshold).toBe(0.6)
		expect(cfg.resume).toBe(false)
		expect(cfg.outputFormat).toBe('json')
		expect(cfg.chunkSize).toBe(300)
		expect(cfg.imgMinArea).toBe(8000)
		expect(cfg.imgGroupThreshold).toBe(0.8)
	})

	it('能正确读取并解析配置文件', () => {
		const configPath = path.join(tmpDir, 'bid-compare.config.toml')
		fs.writeFileSync(
			configPath,
			`
output = "./result"
docs = ["a.pdf", "b.pdf"]
python_path = "./venv/bin/python"
resume = true
output_format = "msgpack"

[thresholds]
img = 0.8
text = 0.6

[text]
chunk_size = 400
chunk_overlap = 40

[image]
min_size = 64
min_area = 12000
group_threshold = 0.9
batch_size = 64
max_show = 100
`,
		)

		const cfg = loadConfig(tmpDir)
		expect(cfg.output).toBe(path.resolve(tmpDir, 'result'))
		expect(cfg.docs).toEqual([path.resolve(tmpDir, 'a.pdf'), path.resolve(tmpDir, 'b.pdf')])
		expect(cfg.pythonPath).toBe(path.resolve(tmpDir, 'venv/bin/python'))
		expect(cfg.resume).toBe(true)
		expect(cfg.outputFormat).toBe('msgpack')
		expect(cfg.imgThreshold).toBe(0.8)
		expect(cfg.textThreshold).toBe(0.6)
		expect(cfg.chunkSize).toBe(400)
		expect(cfg.chunkOverlap).toBe(40)
		expect(cfg.imgMinSize).toBe(64)
		expect(cfg.imgMinArea).toBe(12000)
		expect(cfg.imgGroupThreshold).toBe(0.9)
		expect(cfg.batchSize).toBe(64)
		expect(cfg.maxImgShow).toBe(100)
	})

	it('配置文件未指定项使用默认值', () => {
		const configPath = path.join(tmpDir, 'bid-compare.config.toml')
		fs.writeFileSync(configPath, 'output = "./out"\n')

		const cfg = loadConfig(tmpDir)
		expect(cfg.output).toBe(path.resolve(tmpDir, 'out'))
		expect(cfg.imgThreshold).toBe(0.7)
		expect(cfg.tableThreshold).toBe(0.6)
		expect(cfg.resume).toBe(false)
		expect(cfg.outputFormat).toBe('json')
		expect(cfg.chunkSize).toBe(300)
		expect(cfg.imgMinArea).toBe(8000)
		expect(cfg.imgGroupThreshold).toBe(0.8)
	})
})

describe('mergeWithCliArgs', () => {
	it('CLI 参数覆盖配置文件', () => {
		const config = loadConfig('/tmp')
		const merged = mergeWithCliArgs(config, {
			output: './cli-out',
			imgThreshold: 0.9,
			textThreshold: 0.8,
			tableThreshold: 0.7,
			chunkSize: 500,
			imgMinArea: 10000,
			imgGroupThreshold: 0.9,
			resume: true,
			outputFormat: 'msgpack',
		})
		expect(merged.output).toBe('./cli-out')
		expect(merged.imgThreshold).toBe(0.9)
		expect(merged.textThreshold).toBe(0.8)
		expect(merged.chunkSize).toBe(500)
		expect(merged.imgMinArea).toBe(10000)
		expect(merged.imgGroupThreshold).toBe(0.9)
		expect(merged.resume).toBe(true)
		expect(merged.outputFormat).toBe('msgpack')
	})

	it('未提供的 CLI 参数保留配置值', () => {
		const config = loadConfig('/tmp')
		const merged = mergeWithCliArgs(config, {})
		expect(merged.output).toBe(config.output)
		expect(merged.imgThreshold).toBe(config.imgThreshold)
	})
})

describe('setPythonPathEnv', () => {
	it('设置 PYTHON_PATH 环境变量', () => {
		setPythonPathEnv({ pythonPath: '/usr/bin/python3' } as ReturnType<typeof loadConfig>)
		expect(process.env.PYTHON_PATH).toBe('/usr/bin/python3')
	})

	it('空 pythonPath 不设置环境变量', () => {
		process.env.PYTHON_PATH = undefined
		setPythonPathEnv({ pythonPath: '' } as ReturnType<typeof loadConfig>)
		expect(process.env.PYTHON_PATH).toBeUndefined()
	})
})
