#!/usr/bin/env bun
import fs from 'node:fs'
import path from 'node:path'
import { Command } from 'commander'
import { compareImages, encodeImages } from './compare/image-compare.ts'
import { findSpecialParagraphs } from './compare/special-finder.ts'
import { compareTexts } from './compare/text-compare.ts'
import { DEFAULT_CONFIG } from './config.ts'
import { Logger } from './logger.ts'
import { extractImages } from './pdf/image-extractor.ts'
import { extractTexts } from './pdf/text-extractor.ts'
import { generateHtmlReport } from './report/index.ts'
import type { CliOptions, CompareResult } from './types.ts'

// 脚本所在目录（用于默认 input/output 路径）
const SCRIPT_DIR = import.meta.dir
const DEFAULT_OUTPUT_DIR = path.join(SCRIPT_DIR, '..', 'bid_compare_result')
const DEFAULT_INPUT_DIR = path.join(SCRIPT_DIR, '..', 'input')

const program = new Command()
	.name('bid-compare')
	.description('施工方案文档比对工具 v2.0 (TypeScript)')
	.version('2.0.0')
	.option('--docs <files...>', 'PDF 文档路径列表（默认读取 input/ 目录）')
	.option('--output <dir>', '输出目录', DEFAULT_OUTPUT_DIR)
	.option('--img-threshold <n>', '图片相似度阈值 (0~1)', String(DEFAULT_CONFIG.IMG_THRESHOLD))
	.option('--text-threshold <n>', '文本相似度阈值 (0~1)', String(DEFAULT_CONFIG.TEXT_THRESHOLD))
	.option('--chunk-size <n>', '文本块大小（字符）', String(DEFAULT_CONFIG.CHUNK_SIZE))
	.parse()

const opts = program.opts<CliOptions>()
opts.imgThreshold = Number(opts.imgThreshold)
opts.textThreshold = Number(opts.textThreshold)
opts.chunkSize = Number(opts.chunkSize)

async function main() {
	// 确定输出目录
	const outDir = path.resolve(opts.output)
	fs.mkdirSync(outDir, { recursive: true })

	// 确定文档列表
	let docs = opts.docs
	if (!docs || docs.length === 0) {
		const inputDir = DEFAULT_INPUT_DIR
		if (!fs.existsSync(inputDir)) {
			console.log('='.repeat(60))
			console.log('错误：未找到 input/ 目录')
			console.log('='.repeat(60))
			console.log('请将需要比对的 PDF 文件放入当前目录下的 input/ 文件夹中：')
			console.log('  mkdir input')
			console.log('  cp *.pdf input/')
			console.log('='.repeat(60))
			process.exit(1)
		}

		docs = fs
			.readdirSync(inputDir)
			.filter((f) => f.endsWith('.pdf'))
			.sort()
			.map((f) => path.join(inputDir, f))

		if (docs.length < 2) {
			console.log('='.repeat(60))
			console.log('错误：input/ 目录中的 PDF 文件不足 2 个')
			console.log('='.repeat(60))
			process.exit(1)
		}

		console.log(`自动读取 input/ 目录中的 ${docs.length} 个 PDF 文件：`)
		for (const p of docs) console.log(`  - ${path.basename(p)}`)
		console.log()
	}

	// 验证文件
	for (const p of docs) {
		if (!fs.existsSync(p)) {
			console.error(`Error: 文件不存在: ${p}`)
			process.exit(1)
		}
	}
	if (docs.length < 2) {
		console.error('Error: 至少需要2个文档')
		process.exit(1)
	}

	const logger = new Logger(path.join(outDir, 'compare.log'))

	logger.info('='.repeat(60))
	logger.info(`BidDocComparator v2.0 (TypeScript) | 文本块${opts.chunkSize}字符`)
	logger.info('='.repeat(60))
	logger.info(`文档: ${docs.length}`)
	logger.info(`图片阈值: ${opts.imgThreshold}`)
	logger.info(`文本阈值: ${opts.textThreshold}`)

	const t0 = Date.now()

	// [1/5] 提取文本
	logger.info(`\n[1/5] 提取文本（块大小${opts.chunkSize}字符）...`)
	const allChunks = []
	const docNames: string[] = []
	for (let idx = 0; idx < docs.length; idx++) {
		const chunks = await extractTexts(docs[idx], idx, opts.chunkSize)
		allChunks.push(...chunks)
		docNames.push(path.basename(docs[idx]))
		logger.info(`  doc${idx + 1}: ${chunks.length} 块`)
	}
	logger.info(`  总计: ${allChunks.length} 块`)

	// [2/5] 提取图片
	logger.info('\n[2/5] 提取图片...')
	const allImgsRaw: Awaited<ReturnType<typeof extractImages>> = []
	for (let idx = 0; idx < docs.length; idx++) {
		const imgs = await extractImages(docs[idx], idx)
		allImgsRaw.push(...imgs)
		logger.info(`  doc${idx + 1}: ${imgs.length} 张`)
	}
	logger.info(`  总计: ${allImgsRaw.length} 张`)

	// [2.5/5] 保存图片到输出目录（避免 base64 撑大 JSON/HTML）
	const imagesDir = path.join(outDir, 'images')
	fs.mkdirSync(imagesDir, { recursive: true })
	for (const img of allImgsRaw) {
		const imgName = `doc${img.doc + 1}_page${img.page}_idx${img.idx}.jpg`
		const imgPath = path.join(imagesDir, imgName)
		fs.writeFileSync(imgPath, Buffer.from(img.base64, 'base64'))
		img.imgPath = path.relative(outDir, imgPath)
	}
	logger.info(`  图片已保存到: ${imagesDir}`)

	// [3/5] 图片编码 + 比对
	let imgPairs: CompareResult['imgPairs'] = []
	if (allImgsRaw.length > 0) {
		logger.info('\n[3/5] 图片编码 + 比对...')
		const allImgs = await encodeImages(allImgsRaw)
		imgPairs = compareImages(allImgs, opts.imgThreshold)
		logger.info(`  相似图片对: ${imgPairs.length}`)
	} else {
		logger.info('\n[3/5] 无图片，跳过图片比对')
	}

	// [4/5] 文本比对
	logger.info('\n[4/5] 文本比对...')
	const textPairs = compareTexts(allChunks, opts.textThreshold)
	logger.info(`  相似文本对: ${textPairs.length}`)

	// [5/5] 非标段落
	logger.info('\n[5/5] 非标内容筛选...')
	const specialParas = findSpecialParagraphs(allChunks)
	logger.info(`  非标段落: ${specialParas.length}`)

	// 保存数据
	const result: CompareResult = {
		config: {
			chunkSize: opts.chunkSize,
			imgThreshold: opts.imgThreshold,
			textThreshold: opts.textThreshold,
		},
		docNames,
		allChunks,
		imgPairs,
		textPairs,
		specialParas,
	}

	logger.info('\n保存数据...')
	const dataPath = path.join(outDir, 'report_data.json')
	fs.writeFileSync(dataPath, JSON.stringify(result, null, 2), 'utf-8')
	logger.info(`  数据文件: ${dataPath}`)

	// 生成报告
	logger.info('\n生成报告...')
	const html = generateHtmlReport(result)
	const reportPath = path.join(outDir, 'index.html')
	fs.writeFileSync(reportPath, html, 'utf-8')

	const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
	logger.info(`\n${'='.repeat(60)}`)
	logger.info(`完成! 耗时: ${elapsed}秒`)
	logger.info(`  图片对: ${imgPairs.length}`)
	logger.info(`  文本对: ${textPairs.length}`)
	logger.info(`  非标段: ${specialParas.length}`)
	logger.info(`  数据: ${dataPath}`)
	logger.info(`  报告: ${reportPath}`)
	logger.info('='.repeat(60))
}

main().catch((err) => {
	console.error('执行失败:', err)
	process.exit(1)
})
