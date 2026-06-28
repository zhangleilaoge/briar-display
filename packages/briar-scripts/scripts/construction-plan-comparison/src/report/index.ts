import type { CompareResult } from '../types.ts'
import { getJsLogic } from './js-logic.ts'

/**
 * HTML 转义
 */
function esc(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
}

/**
 * JS 字符串转义
 */
function jsEsc(text: string): string {
	return text
		.replace(/\\/g, '\\\\')
		.replace(/'/g, "\\'")
		.replace(/\n/g, ' ')
		.replace(/\r/g, '')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
}

/**
 * 生成完整交互式 HTML 报告
 */
export function generateHtmlReport(result: CompareResult, maxImgShow = 500): string {
	const {
		docNames,
		allChunks,
		allTables,
		imgPairs,
		imgGroups,
		textPairs,
		tablePairs,
		specialParas,
		config,
	} = result
	const chunkSize = config.chunkSize

	// 准备数据
	const eqPattern = /[A-Z]+[-/]?\d+[A-Z\d/-]*|[A-Z]{2,}\d{2,}[A-Z\d/-]*/g
	const modelsSorted = [
		...new Set(
			allChunks.flatMap((c) => [...(c.text.match(eqPattern) ?? [])].filter((f) => f.length >= 3)),
		),
	].sort()

	const spCounts = docNames.map((_, i) => specialParas.filter((p) => p.doc === i).length)
	const eqCounts = docNames.map(
		(_, i) => specialParas.filter((p) => p.doc === i && p.models.length > 0).length,
	)
	const eqTotal = specialParas.filter((p) => p.models.length > 0).length
	const highTotal = specialParas.filter((p) => p.score > 0.9).length

	// JSON 数据
	const textsJs = JSON.stringify(
		allChunks.map((c) => ({ id: c.id, doc: c.doc, page: c.page, text: jsEsc(c.text) })),
	)
	const chunkMapJs = JSON.stringify(
		Object.fromEntries(
			allChunks.map((c) => [c.id, { doc: c.doc, page: c.page, text: jsEsc(c.text) }]),
		),
	)
	const modelsJs = JSON.stringify(modelsSorted)
	const spJs = JSON.stringify(
		specialParas.map((p) => ({
			doc: p.doc,
			page: p.page,
			chunk_id: p.chunkId,
			score: p.score,
			models: p.models,
			rare_grams: p.rareGrams,
		})),
	)
	const tmJs = JSON.stringify(
		textPairs.map((m) => ({
			sim: m.sim,
			doc_a: m.docA,
			page_a: m.pageA,
			chunk_a_id: m.chunkAId,
			doc_b: m.docB,
			page_b: m.pageB,
			chunk_b_id: m.chunkBId,
		})),
	)
	const imgGroupJs = JSON.stringify(
		imgGroups.slice(0, maxImgShow).map((g) => ({
			id: g.id,
			size: g.size,
			docs: g.docs,
			rep_sim: g.repSim,
			rep_a: {
				doc: g.repA.doc,
				page: g.repA.page,
				w: g.repA.width,
				h: g.repA.height,
				img: g.repA.imgPath,
			},
			rep_b: {
				doc: g.repB.doc,
				page: g.repB.page,
				w: g.repB.width,
				h: g.repB.height,
				img: g.repB.imgPath,
			},
			items_by_doc: g.itemsByDoc.map((d) => ({
				doc: d.doc,
				items: d.items.map((it) => ({
					page: it.page,
					w: it.width,
					h: it.height,
					img: it.imgPath,
				})),
			})),
		})),
	)
	const tableJs = JSON.stringify(
		tablePairs.map((m) => ({
			sim: m.sim,
			shape_sim: m.shapeSim,
			cell_sim: m.cellSim,
			doc_a: m.docA,
			page_a: m.pageA,
			doc_b: m.docB,
			page_b: m.pageB,
			rows_a: m.rowsA,
			rows_b: m.rowsB,
			diff_rows: m.diffRows.map((r) => ({
				type: r.type,
				cells_a: r.cellsA,
				cells_b: r.cellsB,
			})),
		})),
	)

	// 文档标签颜色
	const colors = [
		['dbeafe', '1e40af'],
		['fce7f3', 'be185d'],
		['d1fae5', '166534'],
		['fef3c7', '92400e'],
		['e0e7ff', '3730a3'],
		['fce7f3', '9d174d'],
	]
	const docTagStyles = docNames
		.map((_, i) => {
			const [bg, fg] = colors[i % colors.length]
			return `.d${i}{background:#${bg};color:#${fg}}`
		})
		.join(' ')

	// 文档映射 HTML
	const docMapHtml = docNames
		.map(
			(name, i) =>
				`<div class="doc-map-item"><span class="tag d${i}">文档${i + 1}</span><span class="name">${esc(name)}</span></div>`,
		)
		.join('\n')

	// 文档筛选选项
	const docFilterOptions = docNames
		.map((_, i) => `<option value="${i}">文档${i + 1} (${spCounts[i]})</option>`)
		.join('\n')

	// 文档 tab 复选框
	const docCheckboxes = docNames
		.map((_, i) => `<label><input type="checkbox" id="qDoc${i + 1}" checked> 文档${i + 1}</label>`)
		.join('\n')

	// 型号复选框
	const modelCheckboxes = modelsSorted
		.map(
			(model) =>
				`<label><input type="checkbox" value="${esc(model)}" checked onchange="filterByModel()"> ${esc(model)}</label>`,
		)
		.join('\n')

	// 型号统计
	const modelStatsHtml = `共 <span>${eqCounts.reduce((a, b) => a + b, 0)}</span> 条${docNames.map((_, i) => ` | 文档${i + 1}: <span>${eqCounts[i]}</span>`).join('')}`

	return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>施工方案文档比对报告</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif;background:#0f172a;color:#e2e8f0;line-height:1.6}
.container{max-width:1400px;margin:0 auto;padding:20px}
.doc-map{background:#1e293b;border-radius:12px;padding:15px 20px;margin-bottom:15px;border:1px solid #334155;display:flex;gap:30px;flex-wrap:wrap;justify-content:center;font-size:0.88em}
.doc-map-item{display:flex;align-items:center;gap:8px}
.doc-map-item .name{color:#94a3b8;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nav{position:sticky;top:0;z-index:100;background:#0f172aee;border-bottom:1px solid #334155;padding:12px 0;margin-bottom:15px;backdrop-filter:blur(10px)}
.nav-inner{display:flex;gap:15px;justify-content:center;flex-wrap:wrap}
.nav a{color:#94a3b8;text-decoration:none;padding:8px 18px;border-radius:8px;transition:all .2s;font-size:0.9em}
.nav a:hover{color:#f8fafc;background:#1e293b}
.nav a.active{color:#38bdf8;background:#1e293b;font-weight:600}
.nav-badge{background:#38bdf8;color:#0f172a;padding:1px 8px;border-radius:10px;font-size:0.75em;margin-left:4px}
.header{text-align:center;padding:30px 0;background:linear-gradient(135deg,#1e3a5f,#0f172a);border-radius:16px;margin-bottom:20px;border:1px solid #334155}
.header h1{font-size:2.2em;color:#f8fafc;margin-bottom:8px}
.header .sub{color:#94a3b8}
.drawer{background:#1e293b;border-radius:16px;border:1px solid #334155;margin-bottom:20px;overflow:hidden}
.drawer-header{display:flex;justify-content:space-between;align-items:center;padding:18px 24px;cursor:pointer;transition:background .2s}
.drawer-header:hover{background:#283548}
.drawer-header h2{color:#f8fafc;font-size:1.25em;margin:0;display:flex;align-items:center;gap:10px}
.drawer-header h2 .count{background:#38bdf8;color:#0f172a;font-size:0.6em;padding:2px 10px;border-radius:20px}
.drawer-header .arrow{font-size:1.2em;color:#64748b;transition:transform .3s;display:inline-block}
.drawer.open .arrow{transform:rotate(90deg)}
.drawer-body{display:none}
.drawer.open .drawer-body{display:block}
.drawer-content{padding:0 24px 24px}
.tag{display:inline-block;padding:3px 12px;border-radius:20px;font-size:0.78em;font-weight:600}
${docTagStyles}
.img-group{background:#0f172a;border-radius:12px;border:1px solid #334155;margin-bottom:18px;overflow:hidden}
.img-group-header{padding:15px}
.img-group-rep{display:grid;grid-template-columns:1fr auto 1fr;gap:15px;align-items:center}
.img-group-rep .side{text-align:center}
.img-group-rep .side img{max-width:100%;max-height:260px;object-fit:contain;background:#0a0f1a;border-radius:8px;cursor:pointer;border:1px solid #334155}
.img-group-rep .side img:hover{border-color:#38bdf8}
.img-group-rep .meta{color:#94a3b8;font-size:0.8em;margin-top:6px}
.img-group-rep .vs{text-align:center;color:#64748b;font-weight:bold}
.img-group-rep .vs .sim{font-size:1.4em;display:block;margin-bottom:4px}
.img-group-meta{display:flex;gap:8px;justify-content:center;margin-top:12px;flex-wrap:wrap}
.img-group-docs{padding:0 15px 15px}
.img-doc-group{margin-bottom:10px;background:#1e293b;border-radius:8px}
.img-doc-header{display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;transition:background .2s;border-radius:8px}
.img-doc-header:hover{background:#283548}
.img-doc-header .arrow{font-size:1.1em;color:#64748b;transition:transform .3s;margin-left:auto}
.img-doc-header.open .arrow{transform:rotate(90deg)}
.img-doc-panel{display:none;padding:10px;gap:10px;flex-wrap:wrap}
.img-doc-panel.open{display:flex}
.img-thumb{text-align:center}
.img-thumb img{max-height:90px;max-width:140px;object-fit:contain;background:#0a0f1a;border-radius:6px;cursor:pointer;border:1px solid #334155}
.img-thumb img:hover{border-color:#38bdf8}
.img-thumb .meta{color:#94a3b8;font-size:0.7em;margin-top:4px}
.sim-c1{color:#ef4444}.sim-c2{color:#f97316}.sim-c3{color:#38bdf8}
.table-pair{padding:16px;margin-bottom:16px;background:#0f172a;border-radius:12px;border:1px solid #334155}
.table-pair-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:10px}
.table-pair-header .sim{font-size:1.2em;font-weight:bold;font-family:monospace}
.table-pair-header .source{color:#94a3b8;font-size:0.85em}
.table-pair-body{display:grid;grid-template-columns:1fr auto 1fr;gap:15px;align-items:start}
.table-pair-body .side{overflow-x:auto;background:#1e293b;border-radius:8px;padding:10px}
.table-pair-body table{width:100%;border-collapse:collapse;font-size:0.82em;color:#e2e8f0}
.table-pair-body th,.table-pair-body td{border:1px solid #334155;padding:6px 8px;text-align:left;white-space:nowrap}
.table-pair-body th{background:#0f172a;color:#94a3b8;font-weight:600}
.table-pair-body .row-del{background:rgba(239,68,68,0.18)}
.table-pair-body .row-ins{background:rgba(34,197,94,0.18)}
.table-pair-body .row-mod{background:rgba(251,191,36,0.12)}
.table-pair-body .cell-mod{background:rgba(251,191,36,0.25)}
.text-pair{padding:16px;margin-bottom:12px;background:#0f172a;border-radius:10px;border:1px solid #334155;position:relative}
.text-pair-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:10px}
.text-pair-header .sim{font-size:1.2em;font-weight:bold;font-family:monospace}
.text-pair-header .source{color:#94a3b8;font-size:0.85em}
.text-pair-body{display:grid;grid-template-columns:1fr 1fr;gap:15px}
.text-pair-body .side{background:#1e293b;padding:12px;border-radius:8px;cursor:help;position:relative}
.text-pair-body .side .label{color:#64748b;font-size:0.78em;margin-bottom:4px}
.text-pair-body .side .content{color:#e2e8f0;font-size:0.88em;line-height:1.6;max-height:100px;overflow:hidden}
.text-pair-body .side .fulltext{display:none;position:absolute;left:0;top:100%;width:100%;max-height:400px;overflow-y:auto;background:#1e293b;border:2px solid #38bdf8;border-radius:8px;padding:12px;z-index:50;font-size:0.85em;line-height:1.7;color:#e2e8f0;box-shadow:0 10px 40px rgba(0,0,0,0.5)}
.text-pair-body .side:hover .fulltext{display:block}
.text-pair-diff{margin-top:12px;padding:12px;background:#0a0f1a;border-radius:8px;border:1px solid #334155}
.text-pair-diff .label{color:#64748b;font-size:0.78em;margin-bottom:6px}
.text-pair-diff .diff-content{font-size:0.85em;line-height:1.7;color:#e2e8f0;white-space:pre-wrap}
.diff-del{background:rgba(239,68,68,0.25);color:#fca5a5;text-decoration:line-through;padding:0 2px;border-radius:3px}
.diff-ins{background:rgba(34,197,94,0.25);color:#86efac;padding:0 2px;border-radius:3px}
.pagination{display:flex;justify-content:center;align-items:center;gap:8px;padding:15px 0;flex-wrap:wrap}
.pagination button{padding:6px 14px;background:#334155;color:#e2e8f0;border:none;border-radius:6px;cursor:pointer;font-size:0.85em}
.pagination button:hover{background:#475569}
.pagination button:disabled{opacity:0.4;cursor:not-allowed}
.pagination button.active{background:#38bdf8;color:#0f172a;font-weight:600}
.pagination .info{color:#94a3b8;font-size:0.85em}
.filter-bar{display:flex;gap:10px;margin-bottom:15px;align-items:center;flex-wrap:wrap}
.filter-bar select{padding:8px 14px;background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:8px;font-size:0.85em}
.tabs{display:flex;gap:5px;margin-bottom:15px;border-bottom:2px solid #334155}
.tab-btn{padding:10px 20px;background:none;border:none;color:#94a3b8;cursor:pointer;font-size:0.9em;border-bottom:3px solid transparent;transition:all .2s}
.tab-btn:hover{color:#f8fafc}
.tab-btn.active{color:#38bdf8;border-bottom-color:#38bdf8;font-weight:600}
.tab-panel{display:none}.tab-panel.active{display:block}
.special-item{padding:14px;margin-bottom:10px;background:#0f172a;border-radius:10px;border-left:4px solid #22c55e}
.special-item .meta{display:flex;gap:15px;margin-bottom:6px;font-size:0.82em;color:#94a3b8;flex-wrap:wrap}
.special-item .meta .score{color:#22c55e;font-weight:bold}
.special-item .text{color:#e2e8f0;font-size:0.9em;line-height:1.6}
.special-item mark{background:#fbbf2433;color:#fbbf24;padding:1px 4px;border-radius:3px}
.model-filter{margin-bottom:15px}
.model-filter-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:10px}
.model-filter-header .stats-line{color:#94a3b8;font-size:0.85em}
.model-filter-header .stats-line span{color:#22c55e;font-weight:600}
.model-checkboxes{display:flex;flex-wrap:wrap;gap:6px;max-height:140px;overflow-y:auto;padding:10px;background:#0f172a;border-radius:8px;border:1px solid #334155}
.model-checkboxes label{display:flex;align-items:center;gap:4px;padding:3px 8px;background:#1e293b;border-radius:5px;font-size:0.78em;cursor:pointer}
.model-checkboxes label:hover{background:#283548}
.search-box{width:100%;padding:14px 18px;font-size:1.05em;border:2px solid #334155;border-radius:12px;background:#0f172a;color:#f8fafc;margin-bottom:15px;outline:none}
.search-box:focus{border-color:#38bdf8}
.search-filters{display:flex;gap:10px;margin-bottom:15px;flex-wrap:wrap}
.search-filters label{display:flex;align-items:center;gap:5px;cursor:pointer;padding:8px 15px;background:#334155;border-radius:8px;font-size:0.88em}
.query-result{padding:14px;margin-bottom:10px;background:#0f172a;border-radius:10px;border-left:4px solid #38bdf8}
.query-result .meta{display:flex;gap:15px;margin-bottom:6px;font-size:0.82em;color:#94a3b8}
.query-result mark{background:#fbbf2433;color:#fbbf24;padding:1px 4px;border-radius:3px}
.no-result{text-align:center;color:#64748b;padding:40px}
.overlay{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.93);display:none;justify-content:center;align-items:center;z-index:1000;cursor:zoom-out}
.overlay.active{display:flex}
.overlay img{max-width:93%;max-height:93%;object-fit:contain;border-radius:8px;box-shadow:0 20px 60px rgba(0,0,0,0.6)}
.overlay .close{position:absolute;top:15px;right:25px;color:#fff;font-size:2.5em;cursor:pointer;opacity:0.6;transition:opacity .2s;line-height:1}
.overlay .close:hover{opacity:1}
.overlay .info{position:absolute;bottom:20px;left:50%;transform:translateX(-50%);color:#94a3b8;font-size:0.88em;background:rgba(0,0,0,0.5);padding:6px 16px;border-radius:20px}
footer{text-align:center;color:#64748b;padding:40px 20px;font-size:0.85em}
::-webkit-scrollbar{width:8px}::-webkit-scrollbar-track{background:#0f172a}::-webkit-scrollbar-thumb{background:#334155;border-radius:4px}
</style>
</head>
<body>
<div class="overlay" id="overlay" onclick="closeOverlay()">
<span class="close">&times;</span>
<img id="overlayImg" src="" alt="">
<div class="info" id="overlayInfo"></div>
</div>
<div class="container">
<div class="doc-map">
${docMapHtml}
</div>
<nav class="nav"><div class="nav-inner">
<a href="#sec1" class="active" onclick="setActive(this)">图片比对 <span class="nav-badge">${imgGroups.length}</span></a>
<a href="#sec2" onclick="setActive(this)">表格比对 <span class="nav-badge">${tablePairs.length}</span></a>
<a href="#sec3" onclick="setActive(this)">相似文本 <span class="nav-badge">${textPairs.length}</span></a>
<a href="#sec4" onclick="setActive(this)">非标内容 <span class="nav-badge">${specialParas.length}</span></a>
<a href="#sec5" onclick="setActive(this)">关键词查询</a>
</div></nav>
<div class="header">
<h1>施工方案文档比对报告</h1>
<p class="sub">串标风险排查分析 | ${new Date().toISOString().slice(0, 10)} | 文本块${chunkSize}字符</p>
</div>
<div class="drawer" id="sec1">
<div class="drawer-header" onclick="toggleDrawer(this)">
<h2>图片比对结果 <span class="count" id="imgResultCount">${imgGroups.length}组</span></h2>
<span class="arrow">&#9656;</span>
</div>
<div class="drawer-body"><div class="drawer-content">
<p style="color:#94a3b8;font-size:0.85em;margin-bottom:10px">已将非常相似的图片聚组合并。每组顶部是代表性对比图，下方可按文档展开查看该组全部图片。</p>
<div style="color:#94a3b8;font-size:0.82em;margin-bottom:15px;padding:10px;background:#0f172a;border-radius:8px;border:1px solid #334155">
  <strong style="color:#e2e8f0">说明：</strong>“跨文档相似组”表示 A、B 两份文档里长得很像的图片；“同一文档内重复组”表示只在某一份文档内部重复出现的图片（例如同一页眉、Logo 或图纸在多页重复）。默认只显示跨文档相似组，避免和串标排查无关的内部重复混淆。
</div>
<div class="filter-bar" style="margin-bottom:15px">
  <label style="display:flex;align-items:center;gap:8px;cursor:pointer;color:#e2e8f0;font-size:0.85em">
    <input type="checkbox" id="showIntraDocGroups" onchange="filterImgGroups()">
    显示“同一文档内重复”的组（例如某份文档内部重复的页眉/图纸）
  </label>
</div>
<div id="imgGroupsContainer"></div>
<div class="pagination" id="imgGroupsPagination"></div>
</div></div></div>
<div class="drawer" id="sec2">
<div class="drawer-header" onclick="toggleDrawer(this)">
<h2>表格结构比对 <span class="count" id="tableResultCount">${tablePairs.length}对</span></h2>
<span class="arrow">&#9656;</span>
</div>
<div class="drawer-body"><div class="drawer-content">
<p style="color:#94a3b8;font-size:0.85em;margin-bottom:15px">基于单元格集合与行列形状相似度比对，标记增删改差异。</p>
<div class="filter-bar">
<label>文档筛选:</label>
<select id="tablePairDocFilter" onchange="filterTablePairs()">
<option value="all">全部文档</option>
${docFilterOptions}
</select>
<label>最低相似度:</label>
<select id="tablePairSimFilter" onchange="filterTablePairs()">
<option value="0">全部</option>
<option value="0.6" selected>≥0.6</option>
<option value="0.8">≥0.8</option>
<option value="0.9">≥0.9</option>
</select>
</div>
<div id="tablePairsContainer"></div>
<div class="pagination" id="tablePairsPagination"></div>
</div></div></div>
<div class="drawer" id="sec3">
<div class="drawer-header" onclick="toggleDrawer(this)">
<h2>相似文本对 <span class="count">${textPairs.length}对</span></h2>
<span class="arrow">&#9656;</span>
</div>
<div class="drawer-body"><div class="drawer-content">
<p style="color:#94a3b8;font-size:0.85em;margin-bottom:15px">文本块固定${chunkSize}字符拆分。已过滤标准化内容。鼠标悬停可查看完整内容。</p>
<div class="filter-bar">
<label>文档筛选:</label>
<select id="textPairDocFilter" onchange="filterTextPairs()">
<option value="all">全部文档</option>
${docFilterOptions}
</select>
<label>最低相似度:</label>
<select id="textPairSimFilter" onchange="filterTextPairs()">
<option value="0">全部</option>
<option value="0.7" selected>≥0.7</option>
<option value="0.8">≥0.8</option>
<option value="0.9">≥0.9</option>
</select>
</div>
<div id="textPairsContainer"></div>
<div class="pagination" id="textPairsPagination"></div>
</div></div></div>
<div class="drawer" id="sec4">
<div class="drawer-header" onclick="toggleDrawer(this)">
<h2>低频N-gram非标内容筛选 <span class="count" id="spResultCount">${specialParas.length}段</span></h2>
<span class="arrow">&#9656;</span>
</div>
<div class="drawer-body"><div class="drawer-content">
<div class="filter-bar">
<label>文档筛选:</label>
<select id="spDocFilter" onchange="filterSpecial()">
<option value="all">全部文档</option>
${docFilterOptions}
</select>
</div>
<div class="tabs">
<button class="tab-btn active" onclick="switchTab(this,'sp-all')" id="tab-sp-all">全部(${specialParas.length})</button>
<button class="tab-btn" onclick="switchTab(this,'sp-eq')" id="tab-sp-eq">含设备型号(${eqTotal})</button>
<button class="tab-btn" onclick="switchTab(this,'sp-high')" id="tab-sp-high">非标度>0.9(${highTotal})</button>
</div>
<div class="tab-panel active" id="sp-all">
<div id="spAllContainer"></div>
<div class="pagination" id="spAllPagination"></div>
</div>
<div class="tab-panel" id="sp-eq">
<div class="model-filter">
<div class="model-filter-header">
<div>
<button onclick="selectAllModels(true)" style="padding:4px 12px;background:#334155;color:#e2e8f0;border:none;border-radius:6px;cursor:pointer;font-size:0.82em;margin-right:8px">全选</button>
<button onclick="selectAllModels(false)" style="padding:4px 12px;background:#334155;color:#e2e8f0;border:none;border-radius:6px;cursor:pointer;font-size:0.82em">清空</button>
</div>
<div class="stats-line" id="modelStats">${modelStatsHtml}</div>
</div>
<div class="model-checkboxes" id="modelChecks">
${modelCheckboxes}
</div>
</div>
<div id="spEqContainer"></div>
<div class="pagination" id="spEqPagination"></div>
</div>
<div class="tab-panel" id="sp-high">
<div id="spHighContainer"></div>
<div class="pagination" id="spHighPagination"></div>
</div>
</div></div></div>
<div class="drawer open" id="sec5">
<div class="drawer-header" onclick="toggleDrawer(this)">
<h2>关键词查询 <span class="count">全文</span></h2>
<span class="arrow">&#9656;</span>
</div>
<div class="drawer-body"><div class="drawer-content">
<p style="color:#94a3b8;margin-bottom:15px;font-size:0.88em">输入关键词（设备型号、品牌名、技术参数等），在所有文档段落中实时搜索。支持多关键词空格分隔。</p>
<div class="search-filters">
${docCheckboxes}<label><input type="checkbox" id="qHighlight" checked> 高亮匹配</label>
</div>
<input type="text" class="search-box" id="queryInput" placeholder="输入关键词，如: 变压器 SCBH15 美的 空调 ..." oninput="doSearch()">
<div id="queryResults">
<div class="no-result">输入关键词开始搜索... 试试:
<code style="background:#334155;padding:2px 8px;border-radius:4px;cursor:pointer" onclick="quickSearch('变压器')">变压器</code>
<code style="background:#334155;padding:2px 8px;border-radius:4px;cursor:pointer" onclick="quickSearch('SCBH15')">SCBH15</code>
<code style="background:#334155;padding:2px 8px;border-radius:4px;cursor:pointer" onclick="quickSearch('空调')">空调</code>
</div>
</div>
</div></div></div>
<footer>BidDocComparator v2.0 | 施工方案文档比对工具<br>本报告仅供内部投标文档审查使用</footer>
</div>
<script>
const ALL_TEXTS = ${textsJs};
const CHUNK_MAP = ${chunkMapJs};
const TEXT_PAIRS = ${tmJs};
const TABLE_PAIRS = ${tableJs};
const SPECIAL_PARAS = ${spJs};
const EQ_MODELS = ${modelsJs};
const IMG_GROUPS = ${imgGroupJs};
const DOC_COUNT = ${docNames.length};
${getJsLogic()}
</script>
</body>
</html>`
}
