#!/usr/bin/env bun
import fs from 'node:fs'
import path from 'node:path'
import { encode as msgpackEncode } from '@msgpack/msgpack'
import { Command } from 'commander'
import {
	getCacheDir,
	loadImagesCache,
	loadTextTablesCache,
	saveImagesCache,
	saveTextTablesCache,
} from './cache.ts'
import { compareImages, encodeImages, groupImages } from './compare/image-compare.ts'
import { findSpecialParagraphs } from './compare/special-finder.ts'
import { compareTables } from './compare/table-compare.ts'
import { compareTexts } from './compare/text-compare.ts'
import { loadConfig, mergeWithCliArgs, setPythonPathEnv } from './config-loader.ts'
import { Logger } from './logger.ts'
import { extractImages } from './pdf/image-extractor.ts'
import { extractTextAndTables } from './pdf/text-extractor.ts'
import { PythonEnvError } from './python-env.ts'
import { generateAllInOneHtmlReport } from './report/all-in-one.ts'
import { exportAll } from './report/export.ts'
import { generateHtmlReport } from './report/index.ts'
import type {
	CliOptions,
	CompareResult,
	ImageItem,
	ImageItemSaved,
	TableChunk,
	TextChunk,
} from './types.ts'

// 脚本所在目录（用于默认 input/output 路径）
const SCRIPT_DIR = import.meta.dir
const DEFAULT_INPUT_DIR = path.join(SCRIPT_DIR, '..', 'input')

// 先加载配置文件，再用 CLI 参数覆盖
const fileConfig = loadConfig(process.cwd())

const program = new Command()
	.name('bid-compare')
	.description('施工方案文档比对工具 v2.0 (TypeScript)')
	.version('2.0.0')
	.option('--docs <files...>', 'PDF 文档路径列表（默认读取 input/ 目录）')
	.option('--output <dir>', '输出目录', fileConfig.output)
	.option('--img-threshold <n>', '图片相似度阈值 (0~1)', String(fileConfig.imgThreshold))
	.option('--text-threshold <n>', '文本相似度阈值 (0~1)', String(fileConfig.textThreshold))
	.option('--table-threshold <n>', '表格相似度阈值 (0~1)', String(fileConfig.tableThreshold))
	.option('--chunk-size <n>', '文本块大小（字符）', String(fileConfig.chunkSize))
	.option(
		'--img-min-area <n>',
		'图片最小像素面积（过滤页码/小图标）',
		String(fileConfig.imgMinArea),
	)
	.option(
		'--img-group-threshold <n>',
		'图片聚类阈值（把非常相似的图归入同一 group）',
		String(fileConfig.imgGroupThreshold),
	)
	.option('--resume', '复用缓存的文本/表格/图片编码结果', fileConfig.resume)
	.option('--output-format <format>', '结果数据格式：json 或 msgpack', fileConfig.outputFormat)
	.parse()

const cliOpts = program.opts<CliOptions>()
cliOpts.imgThreshold = Number(cliOpts.imgThreshold)
cliOpts.textThreshold = Number(cliOpts.textThreshold)
cliOpts.tableThreshold = Number(cliOpts.tableThreshold)
cliOpts.chunkSize = Number(cliOpts.chunkSize)
cliOpts.imgMinArea = Number(cliOpts.imgMinArea)
cliOpts.imgGroupThreshold = Number(cliOpts.imgGroupThreshold)
// commander 的 .option('--output-format <format>', ..., 'json') 会返回字符串，无需 Number

const opts = mergeWithCliArgs(fileConfig, cliOpts)
setPythonPathEnv(opts)

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
	logger.info(`表格阈值: ${opts.tableThreshold}`)
	logger.info(`图片最小面积: ${opts.imgMinArea} 像素`)
	logger.info(`图片聚类阈值: ${opts.imgGroupThreshold}`)

	const t0 = Date.now()
	const cacheDir = getCacheDir(outDir)

	// [1/6] 提取文本与表格（并行，单文档失败降级，支持缓存）
	logger.info(`\n[1/6] 提取文本与表格（块大小${opts.chunkSize}字符）...`)
	const docNames = docs.map((p) => path.basename(p))
	const textResults = await Promise.all(
		docs.map(async (doc, idx) => {
			if (opts.resume) {
				const cached = loadTextTablesCache(cacheDir, doc, idx)
				if (cached) {
					logger.info(
						`  doc${idx + 1}: 复用文本/表格缓存（${cached.chunks.length} 块, ${cached.tables.length} 表格）`,
					)
					return { idx, chunks: cached.chunks, tables: cached.tables }
				}
			}
			try {
				const { chunks, tables, warning } = await extractTextAndTables(doc, idx, opts.chunkSize)
				if (warning) {
					logger.warn(`  doc${idx + 1} ${warning}`)
				}
				saveTextTablesCache(cacheDir, doc, idx, chunks, tables)
				return { idx, chunks, tables }
			} catch (err) {
				logger.warn(`  doc${idx + 1} 文本提取失败: ${(err as Error).message}`)
				return { idx, chunks: [] as TextChunk[], tables: [] as TableChunk[] }
			}
		}),
	)
	const allChunks = []
	const allTables = []
	for (const { idx, chunks, tables } of textResults.sort((a, b) => a.idx - b.idx)) {
		allChunks.push(...chunks)
		allTables.push(...tables)
		logger.info(`  doc${idx + 1}: ${chunks.length} 块, ${tables.length} 表格`)
	}
	logger.info(`  总计: ${allChunks.length} 块, ${allTables.length} 表格`)

	// [2/6] 提取图片 / [3/6] 编码 + 比对（支持缓存）
	let allImgs: ImageItem[] = []
	if (opts.resume) {
		const cached = loadImagesCache(outDir)
		if (cached && cached.length > 0) {
			allImgs = cached
			logger.info(`\n[2/6] 复用图片缓存: ${cached.length} 张`)
		}
	}

	if (allImgs.length === 0) {
		logger.info('\n[2/6] 提取图片...')
		const imgResults = await Promise.all(
			docs.map(async (doc, idx) => {
				try {
					const imgs = await extractImages(doc, idx, opts.imgMinSize, opts.imgMinArea)
					return { idx, imgs }
				} catch (err) {
					logger.warn(`  doc${idx + 1} 图片提取失败: ${(err as Error).message}`)
					return { idx, imgs: [] as Awaited<ReturnType<typeof extractImages>> }
				}
			}),
		)
		const allImgsExtracted: Awaited<ReturnType<typeof extractImages>> = []
		for (const { idx, imgs } of imgResults.sort((a, b) => a.idx - b.idx)) {
			allImgsExtracted.push(...imgs)
			logger.info(`  doc${idx + 1}: ${imgs.length} 张`)
		}
		logger.info(`  总计: ${allImgsExtracted.length} 张`)

		// [2.5/6] 保存图片到输出目录（避免 base64 撑大 JSON/HTML）
		const imagesDir = path.join(outDir, 'images')
		fs.mkdirSync(imagesDir, { recursive: true })
		const allImgsRaw: ImageItemSaved[] = []
		for (const img of allImgsExtracted) {
			const imgName = `doc${img.doc + 1}_page${img.page}_idx${img.idx}.jpg`
			const imgPath = path.join(imagesDir, imgName)
			fs.writeFileSync(imgPath, Buffer.from(img.base64, 'base64'))
			allImgsRaw.push({
				...img,
				imgPath: path.relative(outDir, imgPath),
			})
		}
		logger.info(`  图片已保存到: ${imagesDir}`)

		// [2.5/6] 图片编码 + 缓存
		if (allImgsRaw.length > 0) {
			logger.info('\n[2.5/6] 图片编码...')
			allImgs = await encodeImages(allImgsRaw, opts.batchSize, logger)
			saveImagesCache(outDir, allImgs)
			logger.info(`  已缓存 ${allImgs.length} 张图片编码`)
		} else {
			logger.info('\n[2.5/6] 无图片，跳过图片编码')
		}
	}

	let imgPairs: CompareResult['imgPairs'] = []
	let imgGroups: CompareResult['imgGroups'] = []
	if (allImgs.length > 0) {
		logger.info('\n[3/6] 图片比对...')
		imgPairs = compareImages(allImgs, opts.imgThreshold)
		logger.info(`  相似图片对: ${imgPairs.length}`)

		logger.info('\n[3.5/6] 图片聚类...')
		imgGroups = groupImages(allImgs, opts.imgGroupThreshold)
		logger.info(`  相似图片组: ${imgGroups.length}`)
	}

	// [4/6] 文本比对
	logger.info('\n[4/6] 文本比对...')
	const textPairs = compareTexts(allChunks, opts.textThreshold)
	logger.info(`  相似文本对: ${textPairs.length}`)

	// [5/6] 表格结构比对
	let tablePairs: CompareResult['tablePairs'] = []
	if (allTables.length > 0) {
		logger.info('\n[5/6] 表格结构比对...')
		tablePairs = compareTables(allTables, opts.tableThreshold)
		logger.info(`  相似表格对: ${tablePairs.length}`)
	} else {
		logger.info('\n[5/6] 无表格，跳过表格比对')
	}

	// [6/6] 非标段落
	logger.info('\n[6/6] 非标内容筛选...')
	const specialParas = findSpecialParagraphs(allChunks)
	logger.info(`  非标段落: ${specialParas.length}`)

	// 保存数据
	const result: CompareResult = {
		config: {
			chunkSize: opts.chunkSize,
			imgThreshold: opts.imgThreshold,
			textThreshold: opts.textThreshold,
			tableThreshold: opts.tableThreshold,
		},
		docNames,
		allChunks,
		allTables,
		imgPairs,
		imgGroups,
		textPairs,
		tablePairs,
		specialParas,
	}

	logger.info('\n保存数据...')
	const dataPath =
		opts.outputFormat === 'msgpack'
			? path.join(outDir, 'report_data.msgpack')
			: path.join(outDir, 'report_data.json')
	if (opts.outputFormat === 'msgpack') {
		fs.writeFileSync(dataPath, Buffer.from(msgpackEncode(result)))
		logger.info(`  数据文件(MsgPack): ${dataPath}`)
	} else {
		fs.writeFileSync(dataPath, JSON.stringify(result, null, 2), 'utf-8')
		logger.info(`  数据文件(JSON): ${dataPath}`)
	}

	// 生成报告
	logger.info('\n生成报告...')
	const html = generateHtmlReport(result, opts.maxImgShow)
	const reportPath = path.join(outDir, 'index.html')
	fs.writeFileSync(reportPath, html, 'utf-8')

	// 生成 all-in-one 单文件报告（图片内嵌 base64，方便直接转发）
	logger.info('生成 all-in-one 单文件报告...')
	const imgPaths = new Set<string>()
	for (const g of result.imgGroups) {
		imgPaths.add(g.repA.imgPath)
		imgPaths.add(g.repB.imgPath)
		for (const d of g.itemsByDoc) {
			for (const it of d.items) imgPaths.add(it.imgPath)
		}
	}
	const allInOneHtml = generateAllInOneHtmlReport(html, outDir, Array.from(imgPaths))
	const allInOnePath = path.join(outDir, 'index.all-in-one.html')
	fs.writeFileSync(allInOnePath, allInOneHtml, 'utf-8')
	logger.info(`  all-in-one: ${allInOnePath}`)

	// 导出 CSV
	logger.info('\n导出 CSV...')
	const exports = exportAll(outDir, result)
	logger.info(`  文本对: ${exports.textPairs}`)
	logger.info(`  非标段落: ${exports.specialParas}`)
	logger.info(`  图片对: ${exports.imgPairs}`)
	logger.info(`  表格对: ${exports.tablePairs}`)

	const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
	logger.info(`\n${'='.repeat(60)}`)
	logger.info(`完成! 耗时: ${elapsed}秒`)
	logger.info(`  图片对: ${imgPairs.length}`)
	logger.info(`  图片组: ${imgGroups.length}`)
	logger.info(`  文本对: ${textPairs.length}`)
	logger.info(`  表格对: ${tablePairs.length}`)
	logger.info(`  非标段: ${specialParas.length}`)
	logger.info(`  数据: ${dataPath}`)
	logger.info(`  报告: ${reportPath}`)
	logger.info(`  all-in-one: ${allInOnePath}`)
	logger.info('='.repeat(60))
}

main().catch((err) => {
	if (err instanceof PythonEnvError) {
		console.error('='.repeat(60))
		console.error('Python 环境错误：')
		console.error(err.message)
		console.error('='.repeat(60))
	} else {
		console.error('执行失败:', err)
	}
	process.exit(1)
})
