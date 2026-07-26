import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { findPythonPath } from './python-env.ts'

const BENCH_DIR = path.join('/tmp', 'bid-compare-benchmark')
const MAX_TOTAL_TIME_MS = 60_000
const MAX_REPORT_JSON_BYTES = 10_000_000

function exec(
	cmd: string,
	args: string[],
	cwd: string,
): Promise<{ code: number; stdout: string; stderr: string }> {
	return new Promise((resolve) => {
		const proc = spawn(cmd, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'] })
		let stdout = ''
		let stderr = ''
		proc.stdout.on('data', (d) => {
			stdout += d.toString()
		})
		proc.stderr.on('data', (d) => {
			stderr += d.toString()
		})
		proc.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }))
	})
}

function generateTestPdfs(): Promise<{ pdfA: string; pdfB: string }> {
	return new Promise((resolve, reject) => {
		fs.mkdirSync(BENCH_DIR, { recursive: true })

		const pythonPath = process.env.PYTHON_PATH || findPythonPath()
		const script = `
import fitz, io, os
from PIL import Image

def make_pdf(path, extra_text, color):
    doc = fitz.open()
    for p in range(3):
        page = doc.new_page()
        page.insert_text((50, 50 + p*30), '施工组织设计 - 红谷滩区K9学校建设项目', fontsize=14)
        page.insert_text((50, 100), '投标人应根据招标文件和对现场的踏勘情况编制施工组织设计。', fontsize=12)
        page.insert_text((50, 140), extra_text, fontsize=12)
        img = Image.new('RGB', (64, 64), color=color)
        buf = io.BytesIO()
        img.save(buf, format='PNG')
        page.insert_image(fitz.Rect(50, 180, 114, 244), stream=buf.getvalue())
    doc.save(path)
    doc.close()

make_pdf('${path.join(BENCH_DIR, 'a.pdf')}', '本工程采用C30混凝土，钢筋Φ8，工期426工日。', 'red')
make_pdf('${path.join(BENCH_DIR, 'b.pdf')}', '本工程采用C30混凝土，钢筋Φ10，工期313工日。', 'blue')
print('done')
`
		const proc = spawn(pythonPath, ['-c', script])
		let stderr = ''
		proc.stderr.on('data', (d) => {
			stderr += d.toString()
		})
		proc.on('close', (code) => {
			if (code !== 0) {
				reject(new Error(`Failed to generate test PDFs: ${stderr}`))
				return
			}
			resolve({
				pdfA: path.join(BENCH_DIR, 'a.pdf'),
				pdfB: path.join(BENCH_DIR, 'b.pdf'),
			})
		})
	})
}

async function main() {
	fs.rmSync(BENCH_DIR, { recursive: true, force: true })

	console.log('生成基准测试 PDF...')
	const { pdfA, pdfB } = await generateTestPdfs()

	const outputDir = path.join(BENCH_DIR, 'result')
	const scriptDir = process.cwd()

	console.log('运行比对...')
	const start = Date.now()
	const { code, stdout, stderr } = await exec(
		'bun',
		['run', 'src/index.ts', '--docs', pdfA, pdfB, '--output', outputDir],
		scriptDir,
	)
	const elapsed = Date.now() - start

	if (code !== 0) {
		console.error('比对失败:', stderr)
		process.exit(1)
	}

	const jsonPath = path.join(outputDir, 'report_data.json')
	const htmlPath = path.join(outputDir, 'index.html')
	const jsonSize = fs.statSync(jsonPath).size
	const htmlSize = fs.statSync(htmlPath).size

	console.log('\n===== 基准测试结果 =====')
	console.log(`总耗时: ${(elapsed / 1000).toFixed(1)}s`)
	console.log(`report_data.json: ${(jsonSize / 1024 / 1024).toFixed(2)}MB`)
	console.log(`index.html: ${(htmlSize / 1024 / 1024).toFixed(2)}MB`)

	let failed = false
	if (elapsed > MAX_TOTAL_TIME_MS) {
		console.error(`❌ 总耗时超过阈值 ${MAX_TOTAL_TIME_MS / 1000}s`)
		failed = true
	}
	if (jsonSize > MAX_REPORT_JSON_BYTES) {
		console.error(
			`❌ report_data.json 超过阈值 ${(MAX_REPORT_JSON_BYTES / 1024 / 1024).toFixed(1)}MB`,
		)
		failed = true
	}

	if (failed) {
		console.error('\n基准测试未通过')
		process.exit(1)
	}

	console.log('\n✅ 基准测试通过')
}

main().catch((err) => {
	console.error('基准测试失败:', err)
	process.exit(1)
})
