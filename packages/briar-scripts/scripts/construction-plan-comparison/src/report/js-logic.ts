/**
 * 报告页面的前端交互 JS 逻辑
 */
export function getJsLogic(): string {
	return `
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
function toggleDrawer(header) { header.parentElement.classList.toggle("open"); }

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

// 文本差异高亮（字符级 LCS）
function computeDiff(a, b) {
  const n = a.length, m = b.length;
  const dp = Array.from({length: n+1}, () => new Array(m+1).fill(0));
  for (let i = n-1; i >= 0; i--) {
    for (let j = m-1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i+1][j+1] + 1 : Math.max(dp[i+1][j], dp[i][j+1]);
    }
  }
  const segs = [];
  let i = 0, j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) {
      let k = 0;
      while (i+k < n && j+k < m && a[i+k] === b[j+k]) k++;
      segs.push({type:'eq', text:a.substring(i, i+k)});
      i += k; j += k;
    } else if (j < m && (i >= n || dp[i][j+1] >= dp[i+1][j])) {
      segs.push({type:'ins', text:b[j]});
      j++;
    } else if (i < n) {
      segs.push({type:'del', text:a[i]});
      i++;
    } else {
      break;
    }
  }
  // 合并连续同类
  const merged = [];
  for (const seg of segs) {
    const last = merged[merged.length-1];
    if (last && last.type === seg.type) last.text += seg.text;
    else merged.push({type:seg.type, text:seg.text});
  }
  return merged;
}
function renderDiff(a, b) {
  const segs = computeDiff(a, b);
  let html = '';
  for (const s of segs) {
    if (s.type === 'eq') html += escapeHtml(s.text);
    else if (s.type === 'del') html += '<span class="diff-del">' + escapeHtml(s.text) + '</span>';
    else html += '<span class="diff-ins">' + escapeHtml(s.text) + '</span>';
  }
  return html;
}
function escapeHtml(t) {
  return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// 相似文本对分页
const PAIRS_PER_PAGE = 10;
let currentPage = 1;
let filteredTextPairs = TEXT_PAIRS.slice();
function filterTextPairs() {
  const docFilter = document.getElementById("textPairDocFilter").value;
  const simFilter = parseFloat(document.getElementById("textPairSimFilter").value);
  filteredTextPairs = TEXT_PAIRS.filter(m => {
    if (m.sim < simFilter) return false;
    if (docFilter === 'all') return true;
    return m.doc_a == docFilter || m.doc_b == docFilter;
  });
  renderTextPairs(1);
}
function renderTextPairs(page) {
  const container = document.getElementById("textPairsContainer");
  const pagination = document.getElementById("textPairsPagination");
  const totalPages = Math.ceil(filteredTextPairs.length / PAIRS_PER_PAGE) || 1;
  currentPage = Math.max(1, Math.min(page, totalPages));
  const start = (currentPage - 1) * PAIRS_PER_PAGE;
  const pageData = filteredTextPairs.slice(start, start + PAIRS_PER_PAGE);
  let html = '';
  for (const m of pageData) {
    const ca = CHUNK_MAP[m.chunk_a_id] || { text: '' };
    const cb = CHUNK_MAP[m.chunk_b_id] || { text: '' };
    const textA = ca.text;
    const textB = cb.text;
    const sc = m.sim >= 0.90 ? 'sim-c1' : m.sim >= 0.80 ? 'sim-c2' : m.sim >= 0.70 ? 'sim-c3' : '';
    const dl = []; const dc = [];
    for (let i = 0; i < DOC_COUNT; i++) { dl.push('文档' + (i+1)); dc.push('d' + i); }
    const ta = textA.length > 180 ? textA.substring(0,180) + '...' : textA;
    const tb = textB.length > 180 ? textB.substring(0,180) + '...' : textB;
    html += '<div class="text-pair"><div class="text-pair-header">';
    html += '<span class="sim ' + sc + '">相似度: ' + m.sim + '</span>';
    html += '<span class="source"><span class="tag ' + dc[m.doc_a] + '">' + dl[m.doc_a] + '</span> 第' + m.page_a + '页 <span style="color:#64748b;margin:0 8px">vs</span> <span class="tag ' + dc[m.doc_b] + '">' + dl[m.doc_b] + '</span> 第' + m.page_b + '页</span>';
    html += '</div><div class="text-pair-body">';
    html += '<div class="side"><div class="label">' + dl[m.doc_a] + ' 第' + m.page_a + '页</div><div class="content">' + ta + '</div><div class="fulltext">' + textA + '</div></div>';
    html += '<div class="side"><div class="label">' + dl[m.doc_b] + ' 第' + m.page_b + '页</div><div class="content">' + tb + '</div><div class="fulltext">' + textB + '</div></div>';
    html += '</div>';
    html += '<div class="text-pair-diff"><div class="label">差异高亮（以文档' + (m.doc_a+1) + '为基准）</div><div class="diff-content">' + renderDiff(textA, textB) + '</div></div>';
    html += '</div>';
  }
  container.innerHTML = html;
  let ph = '<button ' + (currentPage===1?'disabled':'') + ' onclick="renderTextPairs(' + (currentPage-1) + ')">上一页</button>';
  for (let p = 1; p <= totalPages; p++) {
    if (p===1||p===totalPages||(p>=currentPage-2&&p<=currentPage+2)) ph += '<button class="' + (p===currentPage?'active':'') + '" onclick="renderTextPairs(' + p + ')">' + p + '</button>';
    else if (p===currentPage-3||p===currentPage+3) ph += '<span style="color:#64748b">...</span>';
  }
  ph += '<button ' + (currentPage===totalPages?'disabled':'') + ' onclick="renderTextPairs(' + (currentPage+1) + ')">下一页</button>';
  ph += '<span class="info">第 ' + currentPage + '/' + totalPages + ' 页，共 ' + filteredTextPairs.length + ' 对</span>';
  pagination.innerHTML = ph;
}
filterTextPairs();

// 表格比对分页
const TABLES_PER_PAGE = 5;
let tableCurrentPage = 1;
let filteredTablePairs = TABLE_PAIRS.slice();
function filterTablePairs() {
  const docFilter = document.getElementById("tablePairDocFilter").value;
  const simFilter = parseFloat(document.getElementById("tablePairSimFilter").value);
  filteredTablePairs = TABLE_PAIRS.filter(m => {
    if (m.sim < simFilter) return false;
    if (docFilter === 'all') return true;
    return m.doc_a == docFilter || m.doc_b == docFilter;
  });
  renderTablePairs(1);
}
function renderTableRows(rows, diffRows, side) {
  let html = '<table><tbody>';
  const di = { eq: [], del: [], ins: [], mod: [] };
  for (const r of diffRows) di[r.type].push(r);
  for (const r of diffRows) {
    if (side === 'a' && r.type === 'ins') continue;
    if (side === 'b' && r.type === 'del') continue;
    const cells = side === 'a' ? r.cells_a : r.cells_b;
    const otherCells = side === 'a' ? r.cells_b : r.cells_a;
    let rowClass = '';
    if (r.type === 'del') rowClass = 'row-del';
    else if (r.type === 'ins') rowClass = 'row-ins';
    else if (r.type === 'mod') rowClass = 'row-mod';
    html += '<tr class="' + rowClass + '">';
    const maxLen = Math.max(cells.length, otherCells.length);
    for (let i = 0; i < maxLen; i++) {
      const cell = cells[i] || '';
      const other = otherCells[i] || '';
      let cellClass = '';
      if (r.type === 'mod' && cell !== other) cellClass = 'cell-mod';
      html += '<td class="' + cellClass + '">' + escapeHtml(cell) + '</td>';
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  return html;
}
function renderTablePairs(page) {
  const container = document.getElementById("tablePairsContainer");
  const pagination = document.getElementById("tablePairsPagination");
  const totalPages = Math.ceil(filteredTablePairs.length / TABLES_PER_PAGE) || 1;
  tableCurrentPage = Math.max(1, Math.min(page, totalPages));
  const start = (tableCurrentPage - 1) * TABLES_PER_PAGE;
  const pageData = filteredTablePairs.slice(start, start + TABLES_PER_PAGE);
  let html = '';
  const dl = []; const dc = [];
  for (let i = 0; i < DOC_COUNT; i++) { dl.push('文档' + (i+1)); dc.push('d' + i); }
  for (const m of pageData) {
    const sc = m.sim >= 0.90 ? 'sim-c1' : m.sim >= 0.80 ? 'sim-c2' : m.sim >= 0.70 ? 'sim-c3' : '';
    html += '<div class="table-pair"><div class="table-pair-header">';
    html += '<span class="sim ' + sc + '">相似度: ' + m.sim + '</span>';
    html += '<span class="source"><span class="tag ' + dc[m.doc_a] + '">' + dl[m.doc_a] + '</span> 第' + m.page_a + '页 <span style="color:#64748b;margin:0 8px">vs</span> <span class="tag ' + dc[m.doc_b] + '">' + dl[m.doc_b] + '</span> 第' + m.page_b + '页</span>';
    html += '</div><div class="table-pair-body">';
    html += '<div class="side">' + renderTableRows(m.rows_a, m.diff_rows, 'a') + '</div>';
    html += '<div class="vs" style="text-align:center;color:#64748b;font-weight:bold"><span>形状:' + m.shape_sim + '</span><br><span>单元格:' + m.cell_sim + '</span></div>';
    html += '<div class="side">' + renderTableRows(m.rows_b, m.diff_rows, 'b') + '</div>';
    html += '</div></div>';
  }
  container.innerHTML = html;
  let ph = '<button ' + (tableCurrentPage===1?'disabled':'') + ' onclick="renderTablePairs(' + (tableCurrentPage-1) + ')">上一页</button>';
  for (let p = 1; p <= totalPages; p++) {
    if (p===1||p===totalPages||(p>=tableCurrentPage-2&&p<=tableCurrentPage+2)) ph += '<button class="' + (p===tableCurrentPage?'active':'') + '" onclick="renderTablePairs(' + p + ')">' + p + '</button>';
    else if (p===tableCurrentPage-3||p===tableCurrentPage+3) ph += '<span style="color:#64748b">...</span>';
  }
  ph += '<button ' + (tableCurrentPage===totalPages?'disabled':'') + ' onclick="renderTablePairs(' + (tableCurrentPage+1) + ')">下一页</button>';
  ph += '<span class="info">第 ' + tableCurrentPage + '/' + totalPages + ' 页，共 ' + filteredTablePairs.length + ' 对</span>';
  pagination.innerHTML = ph;
  const tc = document.getElementById("tableResultCount"); if (tc) tc.textContent = filteredTablePairs.length + "对";
}
filterTablePairs();

// 图片聚类组展示
const IMGS_PER_PAGE = 10;
let imgCurrentPage = 1;
function toggleImgDocGroup(header) {
  const panel = header.nextElementSibling;
  panel.classList.toggle('open');
  header.classList.toggle('open');
}
function renderImgItem(it, docIdx) {
  return '<div class="img-thumb"><img src="' + it.img + '" alt="" onclick="openOverlay(this.src,\\'' + '文档' + (docIdx+1) + ' 第' + it.page + '页 ' + it.w + 'x' + it.h + '\\')"><div class="meta">第' + it.page + '页 ' + it.w + 'x' + it.h + '</div></div>';
}
function renderImgGroups(page) {
  const container = document.getElementById("imgGroupsContainer");
  const pagination = document.getElementById("imgGroupsPagination");
  const totalPages = Math.ceil(IMG_GROUPS.length / IMGS_PER_PAGE) || 1;
  imgCurrentPage = Math.max(1, Math.min(page, totalPages));
  const start = (imgCurrentPage - 1) * IMGS_PER_PAGE;
  const pageData = IMG_GROUPS.slice(start, start + IMGS_PER_PAGE);
  const dl = []; const dc = [];
  for (let i = 0; i < DOC_COUNT; i++) { dl.push('文档' + (i+1)); dc.push('d' + i); }
  let html = '';
  for (let i = 0; i < pageData.length; i++) {
    const g = pageData[i]; const gi = start + i;
    const sc = g.rep_sim >= 0.95 ? 'sim-c1' : g.rep_sim >= 0.90 ? 'sim-c2' : 'sim-c3';
    const docTags = g.docs.map(d => '<span class="tag ' + dc[d] + '">' + dl[d] + '</span>').join(' ');
    html += '<div class="img-group"><div class="img-group-header">';
    html += '<div class="img-group-rep"><div class="side">';
    html += '<img src="' + g.rep_a.img + '" alt="" onclick="openOverlay(this.src,\\'' + dl[g.rep_a.doc] + ' 第' + g.rep_a.page + '页 ' + g.rep_a.w + 'x' + g.rep_a.h + '\\')">';
    html += '<div class="meta"><span class="tag ' + dc[g.rep_a.doc] + '">' + dl[g.rep_a.doc] + '</span> 第' + g.rep_a.page + '页 ' + g.rep_a.w + 'x' + g.rep_a.h + '</div></div>';
    html += '<div class="vs"><span class="sim ' + sc + '">' + g.rep_sim + '</span><span>#' + (gi+1) + '</span><span style="font-size:0.75em;color:#64748b">共' + g.size + '张</span></div>';
    html += '<div class="side"><img src="' + g.rep_b.img + '" alt="" onclick="openOverlay(this.src,\\'' + dl[g.rep_b.doc] + ' 第' + g.rep_b.page + '页 ' + g.rep_b.w + 'x' + g.rep_b.h + '\\')">';
    html += '<div class="meta"><span class="tag ' + dc[g.rep_b.doc] + '">' + dl[g.rep_b.doc] + '</span> 第' + g.rep_b.page + '页 ' + g.rep_b.w + 'x' + g.rep_b.h + '</div></div></div>';
    html += '<div class="img-group-meta">' + docTags + '</div>';
    html += '</div><div class="img-group-docs">';
    for (const d of g.items_by_doc) {
      html += '<div class="img-doc-group"><div class="img-doc-header" onclick="toggleImgDocGroup(this)"><span class="tag ' + dc[d.doc] + '">' + dl[d.doc] + '</span> <span>' + d.items.length + ' 张</span><span class="arrow">&#9656;</span></div><div class="img-doc-panel">';
      for (const it of d.items) html += renderImgItem(it, d.doc);
      html += '</div></div>';
    }
    html += '</div></div>';
  }
  container.innerHTML = html;
  let ph = '<button ' + (imgCurrentPage===1?'disabled':'') + ' onclick="renderImgGroups(' + (imgCurrentPage-1) + ')">上一页</button>';
  for (let p = 1; p <= totalPages; p++) {
    if (p===1||p===totalPages||(p>=imgCurrentPage-2&&p<=imgCurrentPage+2)) ph += '<button class="' + (p===imgCurrentPage?'active':'') + '" onclick="renderImgGroups(' + p + ')">' + p + '</button>';
    else if (p===imgCurrentPage-3||p===imgCurrentPage+3) ph += '<span style="color:#64748b">...</span>';
  }
  ph += '<button ' + (imgCurrentPage===totalPages?'disabled':'') + ' onclick="renderImgGroups(' + (imgCurrentPage+1) + ')">下一页</button>';
  ph += '<span class="info">第 ' + imgCurrentPage + '/' + totalPages + ' 页，共 ' + IMG_GROUPS.length + ' 组</span>';
  pagination.innerHTML = ph;
  const rc = document.getElementById("imgResultCount"); if (rc) rc.textContent = IMG_GROUPS.length + "组";
}
renderImgGroups(1);

// 非标内容分页
const SP_PER_PAGE = 10;
let spCurrentPage = { 'sp-all': 1, 'sp-eq': 1, 'sp-high': 1 };
function getSpecialItems(panelId) {
  let items = SPECIAL_PARAS;
  if (panelId === 'sp-eq') items = items.filter(p => p.models && p.models.length > 0);
  else if (panelId === 'sp-high') items = items.filter(p => p.score > 0.9);
  const filter = document.getElementById("spDocFilter").value;
  if (filter !== 'all') items = items.filter(p => p.doc == filter);
  if (panelId === 'sp-eq') {
    const cm = Array.from(document.querySelectorAll("#modelChecks input:checked")).map(cb => cb.value);
    items = items.filter(p => p.models.some(m => cm.includes(m)));
  }
  return items;
}
function renderSpecialItem(p, isEq) {
  const chunk = CHUNK_MAP[p.chunk_id] || { text: '' };
  const grams = (p.rare_grams || []).slice(0, 3).join(', ');
  let txt;
  if (isEq && p.models && p.models.length > 0) {
    const sm = p.models.slice().sort((a, b) => b.length - a.length);
    txt = chunk.text.substring(0, 300);
    for (const m of sm) txt = txt.split(m).join('<mark>' + m + '</mark>');
    if (chunk.text.length > 300) txt += '...';
  } else {
    txt = chunk.text.length > 280 ? chunk.text.substring(0, 280) + '...' : chunk.text;
  }
  const ma = p.models && p.models.length > 0 ? ' data-models="' + JSON.stringify(p.models).replace(/"/g, '&quot;') + '"' : '';
  return '<div class="special-item" data-doc="' + p.doc + '"' + ma + '><div class="meta"><span class="tag d' + p.doc + '">文档' + (p.doc + 1) + '</span><span>第' + p.page + '页</span><span class="score">非标度: ' + p.score + '</span><span style="color:#64748b">特征: ' + grams + '</span></div><div class="text">' + txt + '</div></div>';
}
function renderSpecialPanel(panelId, page) {
  const cm = { 'sp-all': 'spAllContainer', 'sp-eq': 'spEqContainer', 'sp-high': 'spHighContainer' };
  const pm = { 'sp-all': 'spAllPagination', 'sp-eq': 'spEqPagination', 'sp-high': 'spHighPagination' };
  const container = document.getElementById(cm[panelId]);
  const pagination = document.getElementById(pm[panelId]);
  if (!container || !pagination) return;
  const items = getSpecialItems(panelId);
  const totalPages = Math.ceil(items.length / SP_PER_PAGE) || 1;
  page = Math.max(1, Math.min(page, totalPages));
  spCurrentPage[panelId] = page;
  const start = (page - 1) * SP_PER_PAGE;
  const pageData = items.slice(start, start + SP_PER_PAGE);
  let html = '';
  for (const p of pageData) html += renderSpecialItem(p, panelId === 'sp-eq');
  container.innerHTML = html;
  let ph = '<button ' + (page===1?'disabled':'') + ' onclick="renderSpecialPanel(\\'' + panelId + '\\', ' + (page-1) + ')">上一页</button>';
  for (let p = 1; p <= totalPages; p++) {
    if (p===1||p===totalPages||(p>=page-2&&p<=page+2)) ph += '<button class="' + (p===page?'active':'') + '" onclick="renderSpecialPanel(\\'' + panelId + '\\', ' + p + ')">' + p + '</button>';
    else if (p===page-3||p===page+3) ph += '<span style="color:#64748b">...</span>';
  }
  ph += '<button ' + (page===totalPages?'disabled':'') + ' onclick="renderSpecialPanel(\\'' + panelId + '\\', ' + (page+1) + ')">下一页</button>';
  ph += '<span class="info">第 ' + page + '/' + totalPages + ' 页，共 ' + items.length + ' 条</span>';
  pagination.innerHTML = ph;
}
function filterSpecial() {
  const ap = document.querySelector(".tab-panel.active");
  if (ap) { spCurrentPage[ap.id] = 1; renderSpecialPanel(ap.id, 1); }
  updateSpResultCount();
}
function updateSpResultCount() {
  const panels = {'sp-all': 0, 'sp-eq': 0, 'sp-high': 0};
  for (const pid in panels) panels[pid] = getSpecialItems(pid).length;
  const ap = document.querySelector(".tab-panel.active");
  if (ap) { const ce = document.getElementById("spResultCount"); if (ce) ce.textContent = panels[ap.id] + "段"; }
  const tm = {'sp-all': 'tab-sp-all', 'sp-eq': 'tab-sp-eq', 'sp-high': 'tab-sp-high'};
  const tl = {'sp-all': '全部', 'sp-eq': '含设备型号', 'sp-high': '非标度>0.9'};
  for (const pid in tm) { const te = document.getElementById(tm[pid]); if (te) te.textContent = tl[pid] + '(' + panels[pid] + ')'; }
}
function selectAllModels(checked) { document.querySelectorAll("#modelChecks input").forEach(cb => cb.checked = checked); filterByModel(); }
function filterByModel() {
  spCurrentPage['sp-eq'] = 1;
  renderSpecialPanel('sp-eq', 1);
  const items = getSpecialItems('sp-eq');
  const counts = new Array(DOC_COUNT).fill(0);
  for (const p of items) counts[p.doc]++;
  let sh = '共 <span>' + counts.reduce((a,b)=>a+b,0) + '</span> 条';
  for (let i = 0; i < DOC_COUNT; i++) sh += ' | 文档' + (i+1) + ': <span>' + counts[i] + '</span>';
  document.getElementById("modelStats").innerHTML = sh;
}
function quickSearch(kw) { document.getElementById("queryInput").value = kw; doSearch(); }
function doSearch() {
  const query = document.getElementById("queryInput").value.trim();
  const rd = document.getElementById("queryResults");
  if (!query) { rd.innerHTML = '<div class="no-result">输入关键词开始搜索...</div>'; return; }
  const keywords = query.split(/\\s+/).filter(k => k.length > 0);
  const df = [];
  for (let i = 1; i <= DOC_COUNT; i++) { const el = document.getElementById("qDoc" + i); df.push(el ? el.checked : true); }
  const doHl = document.getElementById("qHighlight").checked;
  const matches = [];
  for (const item of ALL_TEXTS) {
    if (!df[item.doc]) continue;
    const tl = item.text.toLowerCase();
    const kl = keywords.map(k => k.toLowerCase());
    if (!kl.every(k => tl.includes(k))) continue;
    matches.push(Object.assign({}, item, {score: kl.filter(k => tl.includes(k)).length, keywords: kl}));
  }
  matches.sort((a, b) => b.score - a.score);
  if (matches.length === 0) { rd.innerHTML = '<div class="no-result">未找到匹配结果</div>'; return; }
  let html = '<div style="margin-bottom:15px;color:#94a3b8">找到 ' + matches.length + ' 条匹配</div>';
  const dl = []; const dc = [];
  for (let i = 0; i < DOC_COUNT; i++) { dl.push('文档' + (i+1)); dc.push('d' + i); }
  for (const m of matches.slice(0, 100)) {
    let dt = m.text.length > 300 ? m.text.substring(0, 300) + '...' : m.text;
    if (doHl) { for (const kw of m.keywords) { const re = new RegExp("(" + kw.replace(/[.*+?^\${}()|[\\]\\\\]/g, "\\\\$&") + ")", "gi"); dt = dt.replace(re, '<mark>$1</mark>'); } }
    html += '<div class="query-result"><div class="meta"><span class="tag ' + dc[m.doc] + '">' + dl[m.doc] + '</span><span>第' + m.page + '页</span><span style="color:#22c55e">匹配度: ' + m.score + '/' + keywords.length + '</span></div><div class="text">' + dt + '</div></div>';
  }
  if (matches.length > 100) html += '<div class="no-result">还有 ' + (matches.length - 100) + ' 条结果未显示</div>';
  rd.innerHTML = html;
}
renderSpecialPanel('sp-all', 1);
renderSpecialPanel('sp-eq', 1);
renderSpecialPanel('sp-high', 1);`
}
