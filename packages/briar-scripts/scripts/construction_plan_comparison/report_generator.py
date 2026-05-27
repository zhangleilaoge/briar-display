import json
import re
from datetime import datetime
from pathlib import Path


def esc(text):
    return text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;')


def js_esc(text):
    return text.replace('\\', '\\\\').replace("'", "\\'").replace('\n', ' ').replace('\r', '').replace('<', '&lt;').replace('>', '&gt;')


def generate_html_report(img_pairs, text_matches, special_paras, chunks, doc_names, output_dir, chunk_size=300):
    """生成完整交互式HTML报告"""
    MAX_IMG_SHOW = 500

    # 准备数据
    models_sorted = sorted(set(f for c in chunks for f in re.compile(r'[A-Z]+[-/]?\d+[A-Z\d/-]*|[A-Z]{2,}\d{2,}[A-Z\d/-]*').findall(c['text']) if len(f) >= 3))
    sp_counts = [sum(1 for p in special_paras if p['doc'] == i) for i in range(len(doc_names))]
    eq_counts = [sum(1 for p in special_paras if p['doc'] == i and p.get('models')) for i in range(len(doc_names))]

    texts_js = json.dumps([{"doc": c['doc'], "page": c['page'], "text": js_esc(c['text'])} for c in chunks], ensure_ascii=False)
    models_js = json.dumps(models_sorted, ensure_ascii=False)
    sp_js = json.dumps([{'doc': p['doc'], 'page': p['page'], 'text': js_esc(p['text']), 'score': p['score'], 'models': p.get('models', []), 'rare_grams': p.get('rare_grams', [])} for p in special_paras], ensure_ascii=False)
    tm_js = json.dumps([{'sim': m['sim'], 'doc_a': m['doc_a'], 'page_a': m['page_a'], 'doc_b': m['doc_b'], 'page_b': m['page_b'], 'text_a': js_esc(m['text_a']), 'text_b': js_esc(m['text_b'])} for m in text_matches], ensure_ascii=False)
    img_js = json.dumps([{'sim': m['sim'], 'doc_a': m['doc_a'], 'page_a': m['page_a'], 'doc_b': m['doc_b'], 'page_b': m['page_b'], 'w_a': m['w_a'], 'h_a': m['h_a'], 'w_b': m['w_b'], 'h_b': m['h_b'], 'b64_a': m['b64_a'], 'b64_b': m['b64_b']} for m in img_pairs[:MAX_IMG_SHOW]], ensure_ascii=False)

    html = '''<!DOCTYPE html>
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
'''
    # 文档标签颜色
    for i in range(len(doc_names)):
        colors = [('dbeafe','1e40af'), ('fce7f3','be185d'), ('d1fae5','166534'), ('fef3c7','92400e'), ('e0e7ff','3730a3'), ('fce7f3','9d174d')]
        bg, fg = colors[i % len(colors)]
        html += f'.d{i}{{background:#{bg};color:#{fg}}} '
    html += '''

/* 图片对 */
.img-pair{display:grid;grid-template-columns:1fr auto 1fr;gap:15px;margin-bottom:18px;padding:15px;background:#0f172a;border-radius:12px;border:1px solid #334155;align-items:center}
.img-pair .side{text-align:center}
.img-pair .side img{max-width:100%;max-height:280px;object-fit:contain;background:#0a0f1a;border-radius:8px;cursor:pointer;border:1px solid #334155}
.img-pair .side img:hover{border-color:#38bdf8}
.img-pair .meta{color:#94a3b8;font-size:0.8em;margin-top:6px}
.img-pair .vs{text-align:center;color:#64748b;font-weight:bold}
.img-pair .vs .sim{font-size:1.4em;display:block;margin-bottom:4px}
.sim-c1{color:#ef4444}.sim-c2{color:#f97316}.sim-c3{color:#38bdf8}

/* 文本对 + hover完整文本 */
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

/* 分页 */
.pagination{display:flex;justify-content:center;align-items:center;gap:8px;padding:15px 0;flex-wrap:wrap}
.pagination button{padding:6px 14px;background:#334155;color:#e2e8f0;border:none;border-radius:6px;cursor:pointer;font-size:0.85em}
.pagination button:hover{background:#475569}
.pagination button:disabled{opacity:0.4;cursor:not-allowed}
.pagination button.active{background:#38bdf8;color:#0f172a;font-weight:600}
.pagination .info{color:#94a3b8;font-size:0.85em}

/* 筛选 */
.filter-bar{display:flex;gap:10px;margin-bottom:15px;align-items:center;flex-wrap:wrap}
.filter-bar select{padding:8px 14px;background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:8px;font-size:0.85em}

/* Tab */
.tabs{display:flex;gap:5px;margin-bottom:15px;border-bottom:2px solid #334155}
.tab-btn{padding:10px 20px;background:none;border:none;color:#94a3b8;cursor:pointer;font-size:0.9em;border-bottom:3px solid transparent;transition:all .2s}
.tab-btn:hover{color:#f8fafc}
.tab-btn.active{color:#38bdf8;border-bottom-color:#38bdf8;font-weight:600}
.tab-panel{display:none}.tab-panel.active{display:block}

/* 非标段落 */
.special-item{padding:14px;margin-bottom:10px;background:#0f172a;border-radius:10px;border-left:4px solid #22c55e}
.special-item .meta{display:flex;gap:15px;margin-bottom:6px;font-size:0.82em;color:#94a3b8;flex-wrap:wrap}
.special-item .meta .score{color:#22c55e;font-weight:bold}
.special-item .text{color:#e2e8f0;font-size:0.9em;line-height:1.6}
.special-item mark{background:#fbbf2433;color:#fbbf24;padding:1px 4px;border-radius:3px}

/* 型号多选 */
.model-filter{margin-bottom:15px}
.model-filter-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:10px}
.model-filter-header .stats-line{color:#94a3b8;font-size:0.85em}
.model-filter-header .stats-line span{color:#22c55e;font-weight:600}
.model-checkboxes{display:flex;flex-wrap:wrap;gap:6px;max-height:140px;overflow-y:auto;padding:10px;background:#0f172a;border-radius:8px;border:1px solid #334155}
.model-checkboxes label{display:flex;align-items:center;gap:4px;padding:3px 8px;background:#1e293b;border-radius:5px;font-size:0.78em;cursor:pointer}
.model-checkboxes label:hover{background:#283548}

/* 搜索 */
.search-box{width:100%;padding:14px 18px;font-size:1.05em;border:2px solid #334155;border-radius:12px;background:#0f172a;color:#f8fafc;margin-bottom:15px;outline:none}
.search-box:focus{border-color:#38bdf8}
.search-filters{display:flex;gap:10px;margin-bottom:15px;flex-wrap:wrap}
.search-filters label{display:flex;align-items:center;gap:5px;cursor:pointer;padding:8px 15px;background:#334155;border-radius:8px;font-size:0.88em}
.query-result{padding:14px;margin-bottom:10px;background:#0f172a;border-radius:10px;border-left:4px solid #38bdf8}
.query-result .meta{display:flex;gap:15px;margin-bottom:6px;font-size:0.82em;color:#94a3b8}
.query-result mark{background:#fbbf2433;color:#fbbf24;padding:1px 4px;border-radius:3px}
.no-result{text-align:center;color:#64748b;padding:40px}

/* 蒙层 */
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

<!-- 文档名映射 -->
<div class="doc-map">
'''
    for i, name in enumerate(doc_names):
        html += f'<div class="doc-map-item"><span class="tag d{i}">文档{i+1}</span><span class="name">{esc(name)}</span></div>\n'

    html += '''
</div>

<nav class="nav"><div class="nav-inner">
<a href="#sec1" class="active" onclick="setActive(this)">图片比对</a>
<a href="#sec2" onclick="setActive(this)">相似文本</a>
<a href="#sec3" onclick="setActive(this)">非标内容</a>
<a href="#sec4" onclick="setActive(this)">关键词查询</a>
</div></nav>

<div class="header">
<h1>施工方案文档比对报告</h1>
<p class="sub">串标风险排查分析 | ''' + datetime.now().strftime('%Y-%m-%d') + ''' | 文本块''' + str(chunk_size) + '''字符</p>
</div>
'''

    # ===== 图片比对 =====
    html += f'''
<div class="drawer" id="sec1">
<div class="drawer-header" onclick="toggleDrawer(this)">
<h2>图片比对结果 <span class="count" id="imgResultCount">{len(img_pairs)}对</span></h2>
<span class="arrow">&#9656;</span>
</div>
<div class="drawer-body"><div class="drawer-content">
<p style="color:#94a3b8;font-size:0.85em;margin-bottom:15px">仅展示相似度最高的前 {min(len(img_pairs), MAX_IMG_SHOW)} 对图片，防止报告过大。</p>
<div id="imgPairsContainer"></div>
<div class="pagination" id="imgPairsPagination"></div>
</div></div></div>
'''

    # ===== 相似文本对 =====
    html += f'''
<div class="drawer" id="sec2">
<div class="drawer-header" onclick="toggleDrawer(this)">
<h2>相似文本对 <span class="count">{len(text_matches)}对</span></h2>
<span class="arrow">&#9656;</span>
</div>
<div class="drawer-body"><div class="drawer-content">
<p style="color:#94a3b8;font-size:0.85em;margin-bottom:15px">文本块固定{chunk_size}字符拆分。已过滤标准化内容（封面、招标文件原文等）。鼠标悬停文本块可查看完整内容。</p>
<div id="textPairsContainer"></div>
<div class="pagination" id="textPairsPagination"></div>
</div></div></div>
'''

    # ===== 非标内容 =====
    eq_total = sum(1 for p in special_paras if p.get('models'))
    high_total = sum(1 for p in special_paras if p['score'] > 0.9)

    html += f'''
<div class="drawer" id="sec3">
<div class="drawer-header" onclick="toggleDrawer(this)">
<h2>低频N-gram非标内容筛选 <span class="count" id="spResultCount">{len(special_paras)}段</span></h2>
<span class="arrow">&#9656;</span>
</div>
<div class="drawer-body"><div class="drawer-content">

<div class="filter-bar">
<label>文档筛选:</label>
<select id="spDocFilter" onchange="filterSpecial()">
<option value="all">全部文档</option>
'''
    for i in range(len(doc_names)):
        html += f'<option value="{i}">文档{i+1} ({sp_counts[i]})</option>\n'
    html += f'''</select>
</div>

<div class="tabs">
<button class="tab-btn active" onclick="switchTab(this,'sp-all')" id="tab-sp-all">全部({len(special_paras)})</button>
<button class="tab-btn" onclick="switchTab(this,'sp-eq')" id="tab-sp-eq">含设备型号({eq_total})</button>
<button class="tab-btn" onclick="switchTab(this,'sp-high')" id="tab-sp-high">非标度>0.9({high_total})</button>
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
<div class="stats-line" id="modelStats">共 <span>''' + str(sum(eq_counts)) + '''</span> 条'''
    for i in range(len(doc_names)):
        html += f' | 文档{i+1}: <span>{eq_counts[i]}</span>'
    html += '''</div>
</div>
<div class="model-checkboxes" id="modelChecks">
'''
    for model in models_sorted:
        html += f'<label><input type="checkbox" value="{esc(model)}" checked onchange="filterByModel()"> {esc(model)}</label>\n'

    html += '''</div>
</div>
<div id="spEqContainer"></div>
<div class="pagination" id="spEqPagination"></div>
</div>

<div class="tab-panel" id="sp-high">
<div id="spHighContainer"></div>
<div class="pagination" id="spHighPagination"></div>
</div>

</div></div></div>
'''

    # ===== 关键词查询 =====
    html += '''
<div class="drawer open" id="sec4">
<div class="drawer-header" onclick="toggleDrawer(this)">
<h2>关键词查询 <span class="count">全文</span></h2>
<span class="arrow">&#9656;</span>
</div>
<div class="drawer-body"><div class="drawer-content">
<p style="color:#94a3b8;margin-bottom:15px;font-size:0.88em">输入关键词（设备型号、品牌名、技术参数等），在所有文档段落中实时搜索。支持多关键词空格分隔。</p>
<div class="search-filters">
'''
    for i in range(len(doc_names)):
        html += f'<label><input type="checkbox" id="qDoc{i+1}" checked> 文档{i+1}</label>\n'
    html += '''<label><input type="checkbox" id="qHighlight" checked> 高亮匹配</label>
</div>
<input type="text" class="search-box" id="queryInput" placeholder="输入关键词，如: 变压器 SCBH15 美的 空调 ..." oninput="doSearch()">
<div id="queryResults">
<div class="no-result">输入关键词开始搜索... 试试:
<code style="background:#334155;padding:2px 8px;border-radius:4px;cursor:pointer" onclick="quickSearch('变压器')">变压器</code>
<code style="background:#334155;padding:2px 8px;border-radius:4px;cursor:pointer" onclick="quickSearch('SCBH15')">SCBH15</code>
<code style="background:#334155;padding:2px 8px;border-radius:4px;cursor:pointer" onclick="quickSearch('空调')">空调</code>
<code style="background:#334155;padding:2px 8px;border-radius:4px;cursor:pointer" onclick="quickSearch('灭火器')">灭火器</code>
<code style="background:#334155;padding:2px 8px;border-radius:4px;cursor:pointer" onclick="quickSearch('KZJ-600')">KZJ-600</code>
</div>
</div>
</div></div></div>

<footer>BidDocComparator v2.0 | 施工方案文档比对工具<br>本报告仅供内部投标文档审查使用</footer>
</div>

<script>
'''

    # JS数据
    html += f'const ALL_TEXTS = {texts_js};\n'
    html += f'const TEXT_PAIRS = {tm_js};\n'
    html += f'const SPECIAL_PARAS = {sp_js};\n'
    html += f'const EQ_MODELS = {models_js};\n'
    html += f'const IMG_PAIRS = {img_js};\n'
    html += f'const DOC_COUNT = {len(doc_names)};\n'

    # JS逻辑
    html += '''
// 蒙层
function openOverlay(src, info) {
    document.getElementById("overlayImg").src = src;
    document.getElementById("overlayInfo").textContent = info;
    document.getElementById("overlay").classList.add("active");
    document.body.style.overflow = "hidden";
}
function closeOverlay() {
    document.getElementById("overlay").classList.remove("active");
    document.body.style.overflow = "";
}
document.addEventListener("keydown", function(e) { if (e.key === "Escape") closeOverlay(); });

// 导航
function setActive(el) {
    document.querySelectorAll(".nav a").forEach(a => a.classList.remove("active"));
    el.classList.add("active");
}
document.querySelectorAll(".nav a").forEach(a => {
    a.addEventListener("click", function(e) { e.preventDefault(); const t = document.querySelector(this.getAttribute("href")); if (t) t.scrollIntoView({behavior:"smooth"}); });
});

// 抽屉
function toggleDrawer(header) {
    header.parentElement.classList.toggle("open");
}

// Tab
function switchTab(btn, panelId) {
    const card = btn.closest(".drawer-content") || btn.closest(".card");
    card.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    card.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(panelId).classList.add("active");
    renderSpecialPanel(panelId, spCurrentPage[panelId] || 1);
    updateSpResultCount();
}

// 相似文本对分页
const PAIRS_PER_PAGE = 10;
let currentPage = 1;

function renderTextPairs(page) {
    const container = document.getElementById("textPairsContainer");
    const pagination = document.getElementById("textPairsPagination");
    const totalPages = Math.ceil(TEXT_PAIRS.length / PAIRS_PER_PAGE);
    currentPage = Math.max(1, Math.min(page, totalPages));
    const start = (currentPage - 1) * PAIRS_PER_PAGE;
    const end = start + PAIRS_PER_PAGE;
    const pageData = TEXT_PAIRS.slice(start, end);
    
    let html = '';
    for (const m of pageData) {
        const simClass = m.sim >= 0.90 ? 'sim-c1' : m.sim >= 0.80 ? 'sim-c2' : m.sim >= 0.70 ? 'sim-c3' : '';
        const docLabels = [];
        const docClasses = [];
        for (let i = 0; i < DOC_COUNT; i++) { docLabels.push('文档' + (i+1)); docClasses.push('d' + i); }
        const ta = m.text_a.length > 180 ? m.text_a.substring(0,180) + '...' : m.text_a;
        const tb = m.text_b.length > 180 ? m.text_b.substring(0,180) + '...' : m.text_b;
        html += '<div class="text-pair">';
        html += '<div class="text-pair-header">';
        html += '<span class="sim ' + simClass + '">相似度: ' + m.sim + '</span>';
        html += '<span class="source"><span class="tag ' + docClasses[m.doc_a] + '">' + docLabels[m.doc_a] + '</span> 第' + m.page_a + '页 <span style="color:#64748b;margin:0 8px">vs</span> <span class="tag ' + docClasses[m.doc_b] + '">' + docLabels[m.doc_b] + '</span> 第' + m.page_b + '页</span>';
        html += '</div>';
        html += '<div class="text-pair-body">';
        html += '<div class="side"><div class="label">' + docLabels[m.doc_a] + ' 第' + m.page_a + '页</div><div class="content">' + ta + '</div><div class="fulltext">' + m.text_a + '</div></div>';
        html += '<div class="side"><div class="label">' + docLabels[m.doc_b] + ' 第' + m.page_b + '页</div><div class="content">' + tb + '</div><div class="fulltext">' + m.text_b + '</div></div>';
        html += '</div></div>';
    }
    container.innerHTML = html;
    
    let pagHtml = '<button ' + (currentPage===1?'disabled':'') + ' onclick="renderTextPairs(' + (currentPage-1) + ')">上一页</button>';
    for (let p = 1; p <= totalPages; p++) {
        if (p === 1 || p === totalPages || (p >= currentPage-2 && p <= currentPage+2)) {
            pagHtml += '<button class="' + (p===currentPage?'active':'') + '" onclick="renderTextPairs(' + p + ')">' + p + '</button>';
        } else if (p === currentPage-3 || p === currentPage+3) {
            pagHtml += '<span style="color:#64748b">...</span>';
        }
    }
    pagHtml += '<button ' + (currentPage===totalPages?'disabled':'') + ' onclick="renderTextPairs(' + (currentPage+1) + ')">下一页</button>';
    pagHtml += '<span class="info">第 ' + currentPage + '/' + totalPages + ' 页，共 ' + TEXT_PAIRS.length + ' 对</span>';
    pagination.innerHTML = pagHtml;
}

renderTextPairs(1);

// 图片比对分页
const IMGS_PER_PAGE = 10;
let imgCurrentPage = 1;

function renderImgPairs(page) {
    const container = document.getElementById("imgPairsContainer");
    const pagination = document.getElementById("imgPairsPagination");
    const totalPages = Math.ceil(IMG_PAIRS.length / IMGS_PER_PAGE);
    imgCurrentPage = Math.max(1, Math.min(page, totalPages));
    const start = (imgCurrentPage - 1) * IMGS_PER_PAGE;
    const end = start + IMGS_PER_PAGE;
    const pageData = IMG_PAIRS.slice(start, end);
    
    let html = '';
    for (let i = 0; i < pageData.length; i++) {
        const m = pageData[i];
        const globalIndex = start + i;
        const sc = m.sim >= 0.95 ? 'sim-c1' : m.sim >= 0.90 ? 'sim-c2' : 'sim-c3';
        const da = m.doc_a + 1, db = m.doc_b + 1;
        html += '<div class="img-pair">';
        html += '<div class="side">';
        html += '<img src="data:image/jpeg;base64,' + m.b64_a + '" alt="" onclick="openOverlay(this.src,\\'文档' + da + ' 第' + m.page_a + '页 ' + m.w_a + 'x' + m.h_a + '\\')">';
        html += '<div class="meta"><span class="tag d' + m.doc_a + '">文档' + da + '</span> 第' + m.page_a + '页 ' + m.w_a + 'x' + m.h_a + '</div>';
        html += '</div>';
        html += '<div class="vs"><span class="sim ' + sc + '">' + m.sim + '</span><span>#' + (globalIndex + 1) + '</span></div>';
        html += '<div class="side">';
        html += '<img src="data:image/jpeg;base64,' + m.b64_b + '" alt="" onclick="openOverlay(this.src,\\'文档' + db + ' 第' + m.page_b + '页 ' + m.w_b + 'x' + m.h_b + '\\')">';
        html += '<div class="meta"><span class="tag d' + m.doc_b + '">文档' + db + '</span> 第' + m.page_b + '页 ' + m.w_b + 'x' + m.h_b + '</div>';
        html += '</div>';
        html += '</div>';
    }
    container.innerHTML = html;
    
    let pagHtml = '<button ' + (imgCurrentPage===1?'disabled':'') + ' onclick="renderImgPairs(' + (imgCurrentPage-1) + ')">上一页</button>';
    for (let p = 1; p <= totalPages; p++) {
        if (p === 1 || p === totalPages || (p >= imgCurrentPage-2 && p <= imgCurrentPage+2)) {
            pagHtml += '<button class="' + (p===imgCurrentPage?'active':'') + '" onclick="renderImgPairs(' + p + ')">' + p + '</button>';
        } else if (p === imgCurrentPage-3 || p === imgCurrentPage+3) {
            pagHtml += '<span style="color:#64748b">...</span>';
        }
    }
    pagHtml += '<button ' + (imgCurrentPage===totalPages?'disabled':'') + ' onclick="renderImgPairs(' + (imgCurrentPage+1) + ')">下一页</button>';
    pagHtml += '<span class="info">第 ' + imgCurrentPage + '/' + totalPages + ' 页，共 ' + IMG_PAIRS.length + ' 对</span>';
    pagination.innerHTML = pagHtml;
}

renderImgPairs(1);

// 非标内容分页
const SP_PER_PAGE = 10;
let spCurrentPage = { 'sp-all': 1, 'sp-eq': 1, 'sp-high': 1 };

function getSpecialItems(panelId) {
    let items = SPECIAL_PARAS;
    if (panelId === 'sp-eq') {
        items = items.filter(p => p.models && p.models.length > 0);
    } else if (panelId === 'sp-high') {
        items = items.filter(p => p.score > 0.9);
    }
    const filter = document.getElementById("spDocFilter").value;
    if (filter !== 'all') {
        items = items.filter(p => p.doc == filter);
    }
    if (panelId === 'sp-eq') {
        const checkedModels = Array.from(document.querySelectorAll("#modelChecks input:checked")).map(cb => cb.value);
        items = items.filter(p => p.models.some(m => checkedModels.includes(m)));
    }
    return items;
}

function renderSpecialItem(p, isEq) {
    const grams = (p.rare_grams || []).slice(0, 3).join(', ');
    let txt;
    if (isEq && p.models && p.models.length > 0) {
        const sortedModels = p.models.slice().sort((a, b) => b.length - a.length);
        txt = p.text.substring(0, 300);
        for (const m of sortedModels) {
            txt = txt.split(m).join('<mark>' + m + '</mark>');
        }
        if (p.text.length > 300) txt += '...';
    } else {
        txt = p.text.length > 280 ? p.text.substring(0, 280) + '...' : p.text;
    }
    const modelsAttr = p.models && p.models.length > 0 ? ' data-models="' + JSON.stringify(p.models).replace(/"/g, '&quot;') + '"' : '';
    return '<div class="special-item" data-doc="' + p.doc + '"' + modelsAttr + '><div class="meta"><span class="tag d' + p.doc + '">文档' + (p.doc + 1) + '</span><span>第' + p.page + '页</span><span class="score">非标度: ' + p.score + '</span><span style="color:#64748b">特征: ' + grams + '</span></div><div class="text">' + txt + '</div></div>';
}

function renderSpecialPanel(panelId, page) {
    const containerMap = { 'sp-all': 'spAllContainer', 'sp-eq': 'spEqContainer', 'sp-high': 'spHighContainer' };
    const paginationMap = { 'sp-all': 'spAllPagination', 'sp-eq': 'spEqPagination', 'sp-high': 'spHighPagination' };
    const container = document.getElementById(containerMap[panelId]);
    const pagination = document.getElementById(paginationMap[panelId]);
    if (!container || !pagination) return;
    const items = getSpecialItems(panelId);
    const totalPages = Math.ceil(items.length / SP_PER_PAGE) || 1;
    page = Math.max(1, Math.min(page, totalPages));
    spCurrentPage[panelId] = page;
    const start = (page - 1) * SP_PER_PAGE;
    const end = start + SP_PER_PAGE;
    const pageData = items.slice(start, end);
    
    let html = '';
    for (const p of pageData) {
        html += renderSpecialItem(p, panelId === 'sp-eq');
    }
    container.innerHTML = html;
    
    let pagHtml = '<button ' + (page===1?'disabled':'') + ' onclick="renderSpecialPanel(\\'' + panelId + '\\', ' + (page-1) + ')">上一页</button>';
    for (let p = 1; p <= totalPages; p++) {
        if (p === 1 || p === totalPages || (p >= page-2 && p <= page+2)) {
            pagHtml += '<button class="' + (p===page?'active':'') + '" onclick="renderSpecialPanel(\\'' + panelId + '\\', ' + p + ')">' + p + '</button>';
        } else if (p === page-3 || p === page+3) {
            pagHtml += '<span style="color:#64748b">...</span>';
        }
    }
    pagHtml += '<button ' + (page===totalPages?'disabled':'') + ' onclick="renderSpecialPanel(\\'' + panelId + '\\', ' + (page+1) + ')">下一页</button>';
    pagHtml += '<span class="info">第 ' + page + '/' + totalPages + ' 页，共 ' + items.length + ' 条</span>';
    pagination.innerHTML = pagHtml;
}

function filterSpecial() {
    const activePanel = document.querySelector(".tab-panel.active");
    if (activePanel) {
        spCurrentPage[activePanel.id] = 1;
        renderSpecialPanel(activePanel.id, 1);
    }
    updateSpResultCount();
}

function updateSpResultCount() {
    const panels = {'sp-all': 0, 'sp-eq': 0, 'sp-high': 0};
    for (const panelId in panels) {
        panels[panelId] = getSpecialItems(panelId).length;
    }
    
    const activePanel = document.querySelector(".tab-panel.active");
    if (activePanel) {
        const countEl = document.getElementById("spResultCount");
        if (countEl) countEl.textContent = panels[activePanel.id] + "段";
    }
    
    const tabMap = {'sp-all': 'tab-sp-all', 'sp-eq': 'tab-sp-eq', 'sp-high': 'tab-sp-high'};
    const tabLabels = {'sp-all': '全部', 'sp-eq': '含设备型号', 'sp-high': '非标度>0.9'};
    for (const panelId in tabMap) {
        const tabEl = document.getElementById(tabMap[panelId]);
        if (tabEl) {
            tabEl.textContent = tabLabels[panelId] + '(' + panels[panelId] + ')';
        }
    }
}

// 型号多选
function selectAllModels(checked) {
    document.querySelectorAll("#modelChecks input").forEach(cb => cb.checked = checked);
    filterByModel();
}

function filterByModel() {
    spCurrentPage['sp-eq'] = 1;
    renderSpecialPanel('sp-eq', 1);
    const items = getSpecialItems('sp-eq');
    let counts = new Array(DOC_COUNT).fill(0);
    for (const p of items) {
        counts[p.doc]++;
    }
    let statsHtml = '共 <span>' + counts.reduce((a,b)=>a+b,0) + '</span> 条';
    for (let i = 0; i < DOC_COUNT; i++) statsHtml += ' | 文档' + (i+1) + ': <span>' + counts[i] + '</span>';
    document.getElementById("modelStats").innerHTML = statsHtml;
}

// 关键词查询
function quickSearch(keyword) {
    document.getElementById("queryInput").value = keyword;
    doSearch();
}

function doSearch() {
    const query = document.getElementById("queryInput").value.trim();
    const resultsDiv = document.getElementById("queryResults");
    if (!query) { resultsDiv.innerHTML = '<div class="no-result">输入关键词开始搜索...</div>'; return; }
    
    const keywords = query.split(/\\s+/).filter(k => k.length > 0);
    const docFilters = [];
    for (let i = 1; i <= DOC_COUNT; i++) {
        const el = document.getElementById("qDoc" + i);
        docFilters.push(el ? el.checked : true);
    }
    const doHighlight = document.getElementById("qHighlight").checked;
    
    const matches = [];
    for (const item of ALL_TEXTS) {
        if (!docFilters[item.doc]) continue;
        const textLower = item.text.toLowerCase();
        const kwLower = keywords.map(k => k.toLowerCase());
        if (!kwLower.every(k => textLower.includes(k))) continue;
        let score = 0;
        for (const k of kwLower) { if (textLower.includes(k)) score++; }
        matches.push(Object.assign({}, item, {score: score, keywords: kwLower}));
    }
    matches.sort((a, b) => b.score - a.score);
    
    if (matches.length === 0) { resultsDiv.innerHTML = '<div class="no-result">未找到匹配结果</div>'; return; }
    
    let html = '<div style="margin-bottom:15px;color:#94a3b8">找到 ' + matches.length + ' 条匹配</div>';
    const docLabels = [];
    const docClasses = [];
    for (let i = 0; i < DOC_COUNT; i++) { docLabels.push('文档' + (i+1)); docClasses.push('d' + i); }
    
    for (const m of matches.slice(0, 100)) {
        let displayText = m.text.length > 300 ? m.text.substring(0, 300) + '...' : m.text;
        if (doHighlight) {
            for (const kw of m.keywords) {
                const regex = new RegExp("(" + kw.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&") + ")", "gi");
                displayText = displayText.replace(regex, '<mark>$1</mark>');
            }
        }
        html += '<div class="query-result"><div class="meta"><span class="tag ' + docClasses[m.doc] + '">' + docLabels[m.doc] + '</span><span>第' + m.page + '页</span><span style="color:#22c55e">匹配度: ' + m.score + '/' + keywords.length + '</span></div><div class="text">' + displayText + '</div></div>';
    }
    if (matches.length > 100) html += '<div class="no-result">还有 ' + (matches.length - 100) + ' 条结果未显示</div>';
    resultsDiv.innerHTML = html;
}

renderSpecialPanel('sp-all', 1);
renderSpecialPanel('sp-eq', 1);
renderSpecialPanel('sp-high', 1);
</script>
</body>
</html>'''

    # 写入文件
    report_path = output_dir / "index.html"
    with open(report_path, 'w', encoding='utf-8') as f:
        f.write(html)
    return report_path
