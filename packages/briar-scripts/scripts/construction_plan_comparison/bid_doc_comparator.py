#!/usr/bin/env python3
"""
============================================================
施工方案文档比对工具 - BidDocComparator v2.0
============================================================
从多份PDF投标/施工方案文档中提取图片和文本，进行交叉比对，
找出相似度高的图片对和段落对，辅助串标风险排查。

依赖:
    pip install pymupdf pillow numpy torch torchvision

用法:
    python bid_doc_comparator.py --docs a.pdf b.pdf --output ./result
    python bid_doc_comparator.py --docs a.pdf b.pdf c.pdf --img-threshold 0.90
============================================================
"""

import argparse
import base64
import hashlib
import io
import json
import math
import os
import re
import sys
import time
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

import fitz
import numpy as np
import torch
import torch.nn as nn
from PIL import Image
from torchvision import models, transforms


# =============================================================================
# 配置
# =============================================================================
CHUNK_SIZE = 300       # 文本块固定字符数
CHUNK_OVERLAP = 30     # 文本块重叠字符数
IMG_THRESHOLD = 0.70   # 图片相似度阈值
TEXT_THRESHOLD = 0.50  # 文本相似度阈值
IMG_MIN_SIZE = 32      # 图片最小尺寸
BATCH_SIZE = 32        # 图片编码批次


# =============================================================================
# 日志
# =============================================================================
class Logger:
    def __init__(self, log_file=None):
        self.log_file = log_file
        if log_file:
            Path(log_file).parent.mkdir(parents=True, exist_ok=True)
            with open(log_file, 'w', encoding='utf-8') as f:
                f.write(f"=== {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ===\n\n")
    def info(self, msg):
        ts = datetime.now().strftime("%H:%M:%S")
        line = f"[{ts}] {msg}"
        print(line)
        if self.log_file:
            with open(self.log_file, 'a', encoding='utf-8') as f:
                f.write(line + "\n")


# =============================================================================
# PDF内容提取
# =============================================================================
def split_fixed(text, chunk_size=CHUNK_SIZE, overlap=CHUNK_OVERLAP):
    """固定长度拆分文本"""
    raw_paras = re.split(r'\n{2,}', text)
    chunks = []
    for para in raw_paras:
        para = re.sub(r'\s+', ' ', para).strip()
        if len(para) < 20:
            continue
        if len(para) <= chunk_size:
            chunks.append(para)
        else:
            start = 0
            while start < len(para):
                end = start + chunk_size
                if end < len(para):
                    for sep in ['。', '；', '！', '？', '. ', '; ', '! ', '? ', '，', ', ']:
                        pos = para.rfind(sep, start + chunk_size // 2, end)
                        if pos > 0:
                            end = pos + len(sep)
                            break
                chunk = para[start:end].strip()
                if len(chunk) >= 20:
                    chunks.append(chunk)
                start = end - overlap
                if start >= len(para):
                    break
    return chunks


def extract_texts(pdf_path, doc_idx):
    """从PDF提取文本，固定长度拆分"""
    doc = fitz.open(pdf_path)
    chunks = []
    for pn in range(len(doc)):
        for chunk in split_fixed(doc[pn].get_text()):
            chunks.append({"doc": doc_idx, "page": pn + 1, "text": chunk})
    doc.close()
    return chunks


def extract_images(pdf_path, doc_idx, encoder, preprocess, device):
    """从PDF提取图片并编码"""
    doc = fitz.open(pdf_path)
    all_imgs = []
    seen = set()
    for pn in range(len(doc)):
        for ii, img in enumerate(doc[pn].get_images(full=True)):
            try:
                b = doc.extract_image(img[0])
                w, h = b["width"], b["height"]
                if w < IMG_MIN_SIZE or h < IMG_MIN_SIZE:
                    continue
                hsh = hashlib.md5(b["image"]).hexdigest()
                if hsh in seen:
                    continue
                seen.add(hsh)
                pil = Image.open(io.BytesIO(b["image"])).convert('RGB')
                t = preprocess(pil).unsqueeze(0).to(device)
                with torch.no_grad():
                    vec = encoder(t).view(-1).cpu().numpy()
                buf = io.BytesIO()
                pil.save(buf, format='JPEG', quality=48)
                all_imgs.append({
                    "doc": doc_idx, "page": pn + 1, "idx": ii + 1,
                    "w": w, "h": h, "vec": vec,
                    "b64": base64.b64encode(buf.getvalue()).decode('utf-8')
                })
            except Exception:
                pass
    doc.close()
    return all_imgs


# =============================================================================
# 图片比对
# =============================================================================
def compare_images(all_imgs, threshold=IMG_THRESHOLD):
    """单图级别余弦相似度比对"""
    vecs = np.array([im["vec"] for im in all_imgs], dtype=np.float32)
    norms = np.linalg.norm(vecs, axis=1, keepdims=True)
    vecs = vecs / (norms + 1e-8)

    img_pairs = []
    n = len(all_imgs)
    for i in range(n):
        doc_i = all_imgs[i]["doc"]
        for j in range(i + 1, n):
            doc_j = all_imgs[j]["doc"]
            if doc_i == doc_j:
                continue
            sim = float(np.dot(vecs[i], vecs[j]))
            if sim < threshold:
                continue
            img_pairs.append({
                "sim": round(sim, 4),
                "doc_a": all_imgs[i]["doc"], "page_a": all_imgs[i]["page"],
                "doc_b": all_imgs[j]["doc"], "page_b": all_imgs[j]["page"],
                "w_a": all_imgs[i]["w"], "h_a": all_imgs[i]["h"],
                "w_b": all_imgs[j]["w"], "h_b": all_imgs[j]["h"],
                "b64_a": all_imgs[i]["b64"], "b64_b": all_imgs[j]["b64"]
            })

    img_pairs.sort(key=lambda x: -x["sim"])
    return img_pairs


# =============================================================================
# 文本比对
# =============================================================================
def char_ngrams(text, n=3):
    cleaned = re.sub(r'[^\u4e00-\u9fff0-9a-zA-Z]', '', text)
    if len(cleaned) < 10:
        return Counter()
    return Counter(cleaned[i:i + n] for i in range(len(cleaned) - n + 1))


def cosine_sim_counter(feat_a, feat_b):
    if not feat_a or not feat_b:
        return 0.0
    common = set(feat_a.keys()) & set(feat_b.keys())
    if not common:
        return 0.0
    dot = sum(feat_a[k] * feat_b[k] for k in common)
    norm_a = math.sqrt(sum(v * v for v in feat_a.values()))
    norm_b = math.sqrt(sum(v * v for v in feat_b.values()))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def is_standardized_text(text):
    """判断是否属于纯标准化/模板内容"""
    t = text.strip()
    if '技术标施工组织设计文件' in t and '投标项目' in t:
        return True
    if t.startswith('附表一') and '附表' in t and '拟投入' in t:
        return True
    if t.count('..') > 20:
        return True
    if '投标人应根据招标文件' in t and '施工组织设计' in t:
        return True
    if t.startswith('中铁六局集团有限公司') and len(t) < 50:
        return True
    return False


def compare_texts(chunks, threshold=TEXT_THRESHOLD):
    """文本跨文档相似度比对"""
    features = [char_ngrams(c['text']) for c in chunks]
    n = len(chunks)
    matches = []
    seen = set()

    for i in range(n):
        if i % 200 == 0:
            print(f"  text {i}/{n} ({len(matches)} matches)", end='\r', flush=True)
        doc_i = chunks[i]['doc']
        for j in range(i + 1, n):
            doc_j = chunks[j]['doc']
            if doc_i == doc_j:
                continue
            sim = cosine_sim_counter(features[i], features[j])
            if sim < threshold:
                continue
            # 过滤标准化内容
            if is_standardized_text(chunks[i]['text']) and is_standardized_text(chunks[j]['text']):
                continue
            pair = tuple(sorted([i, j]))
            if pair in seen:
                continue
            seen.add(pair)
            matches.append({
                "sim": round(sim, 4),
                "doc_a": doc_i, "page_a": chunks[i]['page'],
                "doc_b": doc_j, "page_b": chunks[j]['page'],
                "text_a": chunks[i]['text'], "text_b": chunks[j]['text']
            })
    print(f"\n  text done: {len(matches)} matches")
    matches.sort(key=lambda x: -x['sim'])
    return matches


# =============================================================================
# 非标段落筛选
# =============================================================================
def find_special_paragraphs(chunks):
    """低频N-gram非标内容筛选"""
    eq_pattern = re.compile(r'[A-Z]+[-/]?\d+[A-Z\d/-]*|[A-Z]{2,}\d{2,}[A-Z\d/-]*')
    ngram_size = 4
    all_ngrams = Counter()
    for c in chunks:
        cleaned = re.sub(r'[^\u4e00-\u9fff0-9a-zA-Z]', '', c['text'])
        all_ngrams.update(set(cleaned[i:i + ngram_size] for i in range(len(cleaned) - ngram_size + 1)))
    rare_grams = {g for g, c in all_ngrams.items() if 1 <= c <= 3}

    special = []
    for c in chunks:
        cleaned = re.sub(r'[^\u4e00-\u9fff0-9a-zA-Z]', '', c['text'])
        grams = set(cleaned[i:i + ngram_size] for i in range(len(cleaned) - ngram_size + 1))
        if not grams:
            continue
        score = len(grams & rare_grams) / len(grams)
        is_toc = bool(re.search(r'第[一二三四五六七八九十]+章|目录|第\d+节|\.\.\.\.+', c['text']))
        if score > 0.3 and not is_toc and len(c['text']) > 30:
            models_in = list(set(m for m in eq_pattern.findall(c['text']) if len(m) >= 3))
            special.append({
                **c, 'score': round(score, 4), 'models': models_in,
                'rare_grams': list(grams & rare_grams)[:10]
            })
    special.sort(key=lambda x: -x['score'])
    return special


# =============================================================================
# HTML报告生成
# =============================================================================
def esc(text):
    return text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;')


def js_esc(text):
    return text.replace('\\', '\\\\').replace("'", "\\'").replace('\n', ' ').replace('\r', '').replace('<', '&lt;').replace('>', '&gt;')


def generate_html_report(img_pairs, text_matches, special_paras, chunks, doc_names, output_dir):
    """生成完整交互式HTML报告"""

    # 准备数据
    models_sorted = sorted(set(f for c in chunks for f in re.compile(r'[A-Z]+[-/]?\d+[A-Z\d/-]*|[A-Z]{2,}\d{2,}[A-Z\d/-]*').findall(c['text']) if len(f) >= 3))
    sp_counts = [sum(1 for p in special_paras if p['doc'] == i) for i in range(len(doc_names))]
    eq_counts = [sum(1 for p in special_paras if p['doc'] == i and p.get('models')) for i in range(len(doc_names))]

    texts_js = json.dumps([{"doc": c['doc'], "page": c['page'], "text": js_esc(c['text'])} for c in chunks], ensure_ascii=False)
    models_js = json.dumps(models_sorted, ensure_ascii=False)
    sp_js = json.dumps([{'doc': p['doc'], 'page': p['page'], 'text': js_esc(p['text']), 'score': p['score'], 'models': p.get('models', []), 'rare_grams': p.get('rare_grams', [])} for p in special_paras], ensure_ascii=False)
    tm_js = json.dumps([{'sim': m['sim'], 'doc_a': m['doc_a'], 'page_a': m['page_a'], 'doc_b': m['doc_b'], 'page_b': m['page_b'], 'text_a': js_esc(m['text_a']), 'text_b': js_esc(m['text_b'])} for m in text_matches], ensure_ascii=False)

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
<p class="sub">串标风险排查分析 | ''' + datetime.now().strftime('%Y-%m-%d') + ''' | 文本块''' + str(CHUNK_SIZE) + '''字符</p>
</div>
'''

    # ===== 图片比对 =====
    MAX_IMG_SHOW = 500
    html += f'''
<div class="drawer" id="sec1">
<div class="drawer-header" onclick="toggleDrawer(this)">
<h2>图片比对结果 <span class="count">{len(img_pairs)}对</span></h2>
<span class="arrow">&#9656;</span>
</div>
<div class="drawer-body"><div class="drawer-content">
<p style="color:#94a3b8;font-size:0.85em;margin-bottom:15px">仅展示相似度最高的前 {min(len(img_pairs), MAX_IMG_SHOW)} 对图片，防止报告过大。</p>
'''
    for i, m in enumerate(img_pairs[:MAX_IMG_SHOW]):
        sc = 'sim-c1' if m['sim'] >= 0.95 else 'sim-c2' if m['sim'] >= 0.90 else 'sim-c3'
        da, db = m['doc_a'] + 1, m['doc_b'] + 1
        html += f'''
<div class="img-pair">
<div class="side">
<img src="data:image/jpeg;base64,{m['b64_a']}" alt="" onclick="openOverlay(this.src,'文档{da} 第{m['page_a']}页 {m['w_a']}x{m['h_a']}')">
<div class="meta"><span class="tag d{m['doc_a']}">文档{da}</span> 第{m['page_a']}页 {m['w_a']}x{m['h_a']}</div>
</div>
<div class="vs"><span class="sim {sc}">{m['sim']}</span><span>#{i+1}</span></div>
<div class="side">
<img src="data:image/jpeg;base64,{m['b64_b']}" alt="" onclick="openOverlay(this.src,'文档{db} 第{m['page_b']}页 {m['w_b']}x{m['h_b']}')">
<div class="meta"><span class="tag d{m['doc_b']}">文档{db}</span> 第{m['page_b']}页 {m['w_b']}x{m['h_b']}</div>
</div>
</div>
'''
    if len(img_pairs) > MAX_IMG_SHOW:
        html += f'<div style="text-align:center;color:#64748b;padding:15px">... 还有 {len(img_pairs)-MAX_IMG_SHOW} 对相似图片未显示 ...</div>\n'
    html += '''</div></div></div>
'''

    # ===== 相似文本对 =====
    html += f'''
<div class="drawer" id="sec2">
<div class="drawer-header" onclick="toggleDrawer(this)">
<h2>相似文本对 <span class="count">{len(text_matches)}对</span></h2>
<span class="arrow">&#9656;</span>
</div>
<div class="drawer-body"><div class="drawer-content">
<p style="color:#94a3b8;font-size:0.85em;margin-bottom:15px">文本块固定{CHUNK_SIZE}字符拆分。已过滤标准化内容（封面、招标文件原文等）。鼠标悬停文本块可查看完整内容。</p>
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
<h2>低频N-gram非标内容筛选 <span class="count">{len(special_paras)}段</span></h2>
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
<button class="tab-btn active" onclick="switchTab(this,'sp-all')">全部({len(special_paras)})</button>
<button class="tab-btn" onclick="switchTab(this,'sp-eq')">含设备型号({eq_total})</button>
<button class="tab-btn" onclick="switchTab(this,'sp-high')">非标度>0.9({high_total})</button>
</div>

<div class="tab-panel active" id="sp-all">
'''
    for i, p in enumerate(special_paras):
        if i >= 200:
            html += f'<div style="text-align:center;color:#64748b;padding:15px">... 还有 {len(special_paras)-200} 条 ...</div>\n'
            break
        grams = ', '.join(p.get('rare_grams', [])[:3])
        txt = esc(p['text'][:280]) + ('...' if len(p['text']) > 280 else '')
        html += f'<div class="special-item" data-doc="{p["doc"]}"><div class="meta"><span class="tag d{p["doc"]}">文档{p["doc"]+1}</span><span>第{p["page"]}页</span><span class="score">非标度: {p["score"]}</span><span style="color:#64748b">特征: {grams}</span></div><div class="text">{txt}</div></div>\n'

    html += '''</div>

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
<div id="eqResults">
'''
    for p in special_paras:
        if not p.get('models'):
            continue
        txt = esc(p['text'][:300])
        for m in sorted(set(p['models']), key=len, reverse=True):
            txt = txt.replace(m, '<mark>' + m + '</mark>')
        models_attr = json.dumps(p['models'], ensure_ascii=False)
        html += f'<div class="special-item" data-doc="{p["doc"]}" data-models="{esc(models_attr)}"><div class="meta"><span class="tag d{p["doc"]}">文档{p["doc"]+1}</span><span>第{p["page"]}页</span><span class="score">非标度: {p["score"]}</span></div><div class="text">{txt}{"..." if len(p["text"])>300 else ""}</div></div>\n'

    html += '''</div>
</div>

<div class="tab-panel" id="sp-high">
'''
    for p in special_paras:
        if p['score'] <= 0.9:
            continue
        grams = ', '.join(p.get('rare_grams', [])[:3])
        txt = esc(p['text'][:280]) + ('...' if len(p['text']) > 280 else '')
        html += f'<div class="special-item" data-doc="{p["doc"]}"><div class="meta"><span class="tag d{p["doc"]}">文档{p["doc"]+1}</span><span>第{p["page"]}页</span><span class="score">非标度: {p["score"]}</span><span style="color:#64748b">特征: {grams}</span></div><div class="text">{txt}</div></div>\n'

    html += '''</div>

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

// 非标筛选
function filterSpecial() {
    const filter = document.getElementById("spDocFilter").value;
    document.querySelectorAll(".special-item").forEach(item => {
        item.style.display = (filter === "all" || item.getAttribute("data-doc") === filter) ? "" : "none";
    });
}

// 型号多选
function selectAllModels(checked) {
    document.querySelectorAll("#modelChecks input").forEach(cb => cb.checked = checked);
    filterByModel();
}

function filterByModel() {
    const checkedModels = Array.from(document.querySelectorAll("#modelChecks input:checked")).map(cb => cb.value);
    const items = document.querySelectorAll("#eqResults .special-item");
    let counts = new Array(DOC_COUNT).fill(0);
    items.forEach(item => {
        try {
            const models = JSON.parse(item.getAttribute("data-models") || "[]");
            const hasMatch = models.some(m => checkedModels.includes(m));
            if (hasMatch) {
                item.style.display = "";
                counts[parseInt(item.getAttribute("data-doc"))]++;
            } else {
                item.style.display = "none";
            }
        } catch(e) { item.style.display = "none"; }
    });
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
</script>
</body>
</html>'''

    # 写入文件
    report_path = output_dir / "index.html"
    with open(report_path, 'w', encoding='utf-8') as f:
        f.write(html)
    return report_path


# =============================================================================
# 主流程
# =============================================================================
def main():
    global CHUNK_SIZE, CHUNK_OVERLAP, IMG_THRESHOLD, TEXT_THRESHOLD
    parser = argparse.ArgumentParser(description='施工方案文档比对工具 v2.0')
    parser.add_argument('--docs', nargs='+', default=None, help='PDF文档路径列表（默认读取 input/ 目录）')
    parser.add_argument('--output', default='./bid_compare_result', help='输出目录')
    parser.add_argument('--img-threshold', type=float, default=IMG_THRESHOLD, help='图片相似度阈值')
    parser.add_argument('--text-threshold', type=float, default=TEXT_THRESHOLD, help='文本相似度阈值')
    parser.add_argument('--device', default='cpu', choices=['cpu', 'cuda'], help='计算设备')
    parser.add_argument('--chunk-size', type=int, default=CHUNK_SIZE, help='文本块大小（字符）')
    args = parser.parse_args()

    # 如果没有指定文档，默认读取 input/ 目录
    input_dir = Path("input")
    if args.docs is None:
        if not input_dir.exists():
            print("=" * 60)
            print("错误：未找到 input/ 目录")
            print("=" * 60)
            print("请将需要比对的 PDF 文件放入当前目录下的 input/ 文件夹中：")
            print("  mkdir input")
            print("  cp *.pdf input/")
            print("=" * 60)
            sys.exit(1)

        args.docs = sorted([str(p) for p in input_dir.glob("*.pdf")])
        if len(args.docs) < 2:
            print("=" * 60)
            print("错误：input/ 目录中的 PDF 文件不足 2 个")
            print("=" * 60)
            print(f"当前 input/ 目录中共有 {len(args.docs)} 个 PDF 文件。")
            print("请至少放入 2 份 PDF 文档后再运行。")
            print("=" * 60)
            sys.exit(1)
        print(f"自动读取 input/ 目录中的 {len(args.docs)} 个 PDF 文件：")
        for p in args.docs:
            print(f"  - {Path(p).name}")
        print()

    # 更新配置
    CHUNK_SIZE = args.chunk_size
    CHUNK_OVERLAP = args.chunk_size // 10
    IMG_THRESHOLD = args.img_threshold
    TEXT_THRESHOLD = args.text_threshold

    # 验证文件
    for p in args.docs:
        if not os.path.exists(p):
            print(f"Error: 文件不存在: {p}")
            sys.exit(1)
    if len(args.docs) < 2:
        print("Error: 至少需要2个文档")
        sys.exit(1)

    out_dir = Path(args.output)
    out_dir.mkdir(parents=True, exist_ok=True)
    logger = Logger(out_dir / "compare.log")

    logger.info("=" * 60)
    logger.info(f"BidDocComparator v2.0 | 文本块{CHUNK_SIZE}字符")
    logger.info("=" * 60)
    logger.info(f"文档: {len(args.docs)}")
    logger.info(f"图片阈值: {IMG_THRESHOLD}")
    logger.info(f"文本阈值: {TEXT_THRESHOLD}")
    logger.info(f"设备: {args.device}")

    if args.device == 'cuda' and not torch.cuda.is_available():
        logger.info("CUDA不可用，回退到CPU")
        args.device = 'cpu'

    t0 = time.time()

    # 初始化图片编码器
    logger.info("\n[1/5] 初始化图片编码器...")
    device = args.device
    resnet = models.resnet18(weights=models.ResNet18_Weights.DEFAULT)
    encoder = nn.Sequential(*list(resnet.children())[:-1]).to(device).eval()
    preprocess = transforms.Compose([
        transforms.Resize((128, 128)), transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ])

    # 提取文本
    logger.info(f"\n[2/5] 提取文本（块大小{CHUNK_SIZE}字符）...")
    all_chunks = []
    doc_names = []
    for idx, path in enumerate(args.docs):
        chunks = extract_texts(path, idx)
        all_chunks.extend(chunks)
        doc_names.append(Path(path).name)
        logger.info(f"  doc{idx+1}: {len(chunks)} 块")
    logger.info(f"  总计: {len(all_chunks)} 块")

    # 提取图片
    logger.info(f"\n[3/5] 提取图片...")
    all_imgs = []
    for idx, path in enumerate(args.docs):
        imgs = extract_images(path, idx, encoder, preprocess, device)
        all_imgs.extend(imgs)
        logger.info(f"  doc{idx+1}: {len(imgs)} 张")
    logger.info(f"  总计: {len(all_imgs)} 张")

    # 图片比对
    logger.info(f"\n[4/5] 图片比对...")
    img_pairs = compare_images(all_imgs, IMG_THRESHOLD)
    logger.info(f"  相似图片对: {len(img_pairs)}")

    # 文本比对
    logger.info(f"\n[5/5] 文本比对...")
    text_pairs = compare_texts(all_chunks, TEXT_THRESHOLD)
    logger.info(f"  相似文本对: {len(text_pairs)}")

    # 非标段落
    logger.info(f"\n[额外] 非标内容筛选...")
    special_paras = find_special_paragraphs(all_chunks)
    logger.info(f"  非标段落: {len(special_paras)}")

    # 生成报告
    logger.info(f"\n生成报告...")
    report_path = generate_html_report(img_pairs, text_pairs, special_paras, all_chunks, doc_names, out_dir)

    elapsed = time.time() - t0
    logger.info(f"\n{'=' * 60}")
    logger.info(f"完成! 耗时: {elapsed:.1f}秒")
    logger.info(f"  图片对: {len(img_pairs)}")
    logger.info(f"  文本对: {len(text_pairs)}")
    logger.info(f"  非标段: {len(special_paras)}")
    logger.info(f"  报告: {report_path}")
    logger.info(f"{'=' * 60}")


if __name__ == "__main__":
    # 强制 Windows 控制台使用 UTF-8 输出，避免中文乱码
    if sys.platform == "win32":
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', line_buffering=True)
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', line_buffering=True)
    main()
