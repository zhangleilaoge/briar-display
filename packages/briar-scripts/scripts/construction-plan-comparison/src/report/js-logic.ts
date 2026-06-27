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

// 相似文本对分页
const PAIRS_PER_PAGE = 10;
let currentPage = 1;
function renderTextPairs(page) {
  const container = document.getElementById("textPairsContainer");
  const pagination = document.getElementById("textPairsPagination");
  const totalPages = Math.ceil(TEXT_PAIRS.length / PAIRS_PER_PAGE);
  currentPage = Math.max(1, Math.min(page, totalPages));
  const start = (currentPage - 1) * PAIRS_PER_PAGE;
  const pageData = TEXT_PAIRS.slice(start, start + PAIRS_PER_PAGE);
  let html = '';
  for (const m of pageData) {
    const sc = m.sim >= 0.90 ? 'sim-c1' : m.sim >= 0.80 ? 'sim-c2' : m.sim >= 0.70 ? 'sim-c3' : '';
    const dl = []; const dc = [];
    for (let i = 0; i < DOC_COUNT; i++) { dl.push('文档' + (i+1)); dc.push('d' + i); }
    const ta = m.text_a.length > 180 ? m.text_a.substring(0,180) + '...' : m.text_a;
    const tb = m.text_b.length > 180 ? m.text_b.substring(0,180) + '...' : m.text_b;
    html += '<div class="text-pair"><div class="text-pair-header">';
    html += '<span class="sim ' + sc + '">相似度: ' + m.sim + '</span>';
    html += '<span class="source"><span class="tag ' + dc[m.doc_a] + '">' + dl[m.doc_a] + '</span> 第' + m.page_a + '页 <span style="color:#64748b;margin:0 8px">vs</span> <span class="tag ' + dc[m.doc_b] + '">' + dl[m.doc_b] + '</span> 第' + m.page_b + '页</span>';
    html += '</div><div class="text-pair-body">';
    html += '<div class="side"><div class="label">' + dl[m.doc_a] + ' 第' + m.page_a + '页</div><div class="content">' + ta + '</div><div class="fulltext">' + m.text_a + '</div></div>';
    html += '<div class="side"><div class="label">' + dl[m.doc_b] + ' 第' + m.page_b + '页</div><div class="content">' + tb + '</div><div class="fulltext">' + m.text_b + '</div></div>';
    html += '</div></div>';
  }
  container.innerHTML = html;
  let ph = '<button ' + (currentPage===1?'disabled':'') + ' onclick="renderTextPairs(' + (currentPage-1) + ')">上一页</button>';
  for (let p = 1; p <= totalPages; p++) {
    if (p===1||p===totalPages||(p>=currentPage-2&&p<=currentPage+2)) ph += '<button class="' + (p===currentPage?'active':'') + '" onclick="renderTextPairs(' + p + ')">' + p + '</button>';
    else if (p===currentPage-3||p===currentPage+3) ph += '<span style="color:#64748b">...</span>';
  }
  ph += '<button ' + (currentPage===totalPages?'disabled':'') + ' onclick="renderTextPairs(' + (currentPage+1) + ')">下一页</button>';
  ph += '<span class="info">第 ' + currentPage + '/' + totalPages + ' 页，共 ' + TEXT_PAIRS.length + ' 对</span>';
  pagination.innerHTML = ph;
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
  const pageData = IMG_PAIRS.slice(start, start + IMGS_PER_PAGE);
  let html = '';
  for (let i = 0; i < pageData.length; i++) {
    const m = pageData[i]; const gi = start + i;
    const sc = m.sim >= 0.95 ? 'sim-c1' : m.sim >= 0.90 ? 'sim-c2' : 'sim-c3';
    html += '<div class="img-pair"><div class="side">';
    html += '<img src="' + m.img_a + '" alt="" onclick="openOverlay(this.src,\\'' + '文档' + (m.doc_a+1) + ' 第' + m.page_a + '页 ' + m.w_a + 'x' + m.h_a + '\\')">';
    html += '<div class="meta"><span class="tag d' + m.doc_a + '">文档' + (m.doc_a+1) + '</span> 第' + m.page_a + '页 ' + m.w_a + 'x' + m.h_a + '</div></div>';
    html += '<div class="vs"><span class="sim ' + sc + '">' + m.sim + '</span><span>#' + (gi+1) + '</span></div>';
    html += '<div class="side"><img src="' + m.img_b + '" alt="" onclick="openOverlay(this.src,\\'' + '文档' + (m.doc_b+1) + ' 第' + m.page_b + '页 ' + m.w_b + 'x' + m.h_b + '\\')">';
    html += '<div class="meta"><span class="tag d' + m.doc_b + '">文档' + (m.doc_b+1) + '</span> 第' + m.page_b + '页 ' + m.w_b + 'x' + m.h_b + '</div></div></div>';
  }
  container.innerHTML = html;
  let ph = '<button ' + (imgCurrentPage===1?'disabled':'') + ' onclick="renderImgPairs(' + (imgCurrentPage-1) + ')">上一页</button>';
  for (let p = 1; p <= totalPages; p++) {
    if (p===1||p===totalPages||(p>=imgCurrentPage-2&&p<=imgCurrentPage+2)) ph += '<button class="' + (p===imgCurrentPage?'active':'') + '" onclick="renderImgPairs(' + p + ')">' + p + '</button>';
    else if (p===imgCurrentPage-3||p===imgCurrentPage+3) ph += '<span style="color:#64748b">...</span>';
  }
  ph += '<button ' + (imgCurrentPage===totalPages?'disabled':'') + ' onclick="renderImgPairs(' + (imgCurrentPage+1) + ')">下一页</button>';
  ph += '<span class="info">第 ' + imgCurrentPage + '/' + totalPages + ' 页，共 ' + IMG_PAIRS.length + ' 对</span>';
  pagination.innerHTML = ph;
}
renderImgPairs(1);

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
  const grams = (p.rare_grams || []).slice(0, 3).join(', ');
  let txt;
  if (isEq && p.models && p.models.length > 0) {
    const sm = p.models.slice().sort((a, b) => b.length - a.length);
    txt = p.text.substring(0, 300);
    for (const m of sm) txt = txt.split(m).join('<mark>' + m + '</mark>');
    if (p.text.length > 300) txt += '...';
  } else {
    txt = p.text.length > 280 ? p.text.substring(0, 280) + '...' : p.text;
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
