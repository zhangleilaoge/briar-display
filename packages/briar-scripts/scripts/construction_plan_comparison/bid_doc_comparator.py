#!/usr/bin/env python3
"""
============================================================
施工方案文档比对工具 - Bid Document Comparator v1.1
============================================================
用于检测多份投标/施工方案文档中重复的图片和段落，
辅助串标风险排查。

功能:
  1. 从多个PDF文档中提取图片和文本
  2. 对图片进行向量化并交叉比对，找出相似度高的图片对
  3. 对文本段落进行TF-IDF编码并交叉比对，找出相似度高的段落对
  4. 使用FAISS索引加速大规模向量搜索
  5. 生成HTML报告、文本报告和JSON详细数据

依赖安装:
    pip install pymupdf pillow numpy scikit-learn faiss-cpu torch torchvision

用法:
    # 方式1：指定PDF文件路径
    python bid_doc_comparator.py --docs a.pdf b.pdf --output ./result

    # 方式2：使用 workspace 目录（推荐）
    # 1. 把PDF文件放到 workspace/ 目录下
    # 2. 直接运行：
    python bid_doc_comparator.py --workspace ./workspace --output ./result

    # 方式3：通配符批量比对
    python bid_doc_comparator.py --docs *.pdf --output ./result --img-threshold 0.90

    # 方式4：GPU加速
    python bid_doc_comparator.py --docs a.pdf b.pdf --output ./result --device cuda

注意:
    - 每次运行会自动清空输出目录，避免旧产物干扰
    - 首次运行会自动下载PyTorch模型（约45MB，仅需一次）

作者: AI Assistant
日期: 2026-05-24
版本: 1.1
============================================================
"""

import argparse
import hashlib
import io
import json
import os
import re
import shutil
import sys
import time
from collections import defaultdict
from datetime import datetime
from pathlib import Path

import faiss
import fitz
import numpy as np
import torch
import torch.nn as nn
from PIL import Image
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from torchvision import models, transforms


# =============================================================================
# 默认配置
# =============================================================================
DEFAULT_IMG_THRESHOLD = 0.85
DEFAULT_TEXT_THRESHOLD = 0.80
DEFAULT_IMG_MIN_SIZE = 32
DEFAULT_TEXT_MIN_LEN = 20
DEFAULT_DEVICE = "cpu"


# =============================================================================
# 日志工具
# =============================================================================
class Logger:
    def __init__(self, log_file=None):
        self.log_file = log_file
        if log_file:
            Path(log_file).parent.mkdir(parents=True, exist_ok=True)
            with open(log_file, 'w', encoding='utf-8') as f:
                f.write(f"=== BidDocComparator Log {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ===\n\n")
    
    def log(self, msg, level="INFO"):
        ts = datetime.now().strftime("%H:%M:%S")
        line = f"[{ts}] [{level}] {msg}"
        print(line)
        if self.log_file:
            with open(self.log_file, 'a', encoding='utf-8') as f:
                f.write(line + "\n")
    
    def info(self, msg): self.log(msg, "INFO")
    def warn(self, msg): self.log(msg, "WARN")
    def error(self, msg): self.log(msg, "ERROR")


# =============================================================================
# PDF内容提取
# =============================================================================
def split_text(text, min_len=20, chunk_size=500, overlap=50):
    """将文本拆分为段落（生成器，避免累积大列表）"""
    MAX_TEXT_LEN = 50000
    if len(text) > MAX_TEXT_LEN:
        text = text[:MAX_TEXT_LEN]
    
    raw = re.split(r'\n\s*\n', text)
    for para in raw:
        para = re.sub(r'\s+', ' ', para).strip()
        if not para or len(para) < min_len:
            continue
        if len(para) > chunk_size:
            start = 0
            while start < len(para):
                end = min(start + chunk_size, len(para))
                chunk = para[start:end].strip()
                if len(chunk) >= min_len:
                    yield chunk
                start = end - overlap
                if start >= len(para):
                    break
        else:
            yield para


def extract_pdf_content(pdf_path, doc_idx, output_dir, logger=None):
    """从PDF中提取图片和文本（图片存硬盘，不驻留内存）"""
    log = logger or Logger()
    doc_name = Path(pdf_path).stem
    log.info(f"Extracting doc{doc_idx+1}: {doc_name}")
    
    doc = fitz.open(pdf_path)
    img_records = []
    text_records = []
    seen_hashes = set()
    
    # 创建该文档的图片缓存目录
    img_cache_dir = Path(output_dir) / f"doc{doc_idx}_{doc_name}" / "images"
    img_cache_dir.mkdir(parents=True, exist_ok=True)
    
    for pn in range(len(doc)):
        page = doc[pn]
        
        # 提取图片 → 直接写入硬盘
        for ii, img in enumerate(page.get_images(full=True)):
            try:
                base = doc.extract_image(img[0])
                w, h = base["width"], base["height"]
                if w < DEFAULT_IMG_MIN_SIZE or h < DEFAULT_IMG_MIN_SIZE:
                    continue
                hsh = hashlib.md5(base["image"]).hexdigest()
                if hsh in seen_hashes:
                    continue
                seen_hashes.add(hsh)
                
                # 保存到硬盘，记录路径
                img_path = img_cache_dir / f"p{pn+1}_i{ii+1}.png"
                with open(img_path, 'wb') as f:
                    f.write(base["image"])
                
                img_records.append({
                    "doc": doc_idx, "page": pn + 1, "img_idx": ii + 1,
                    "hash": hsh, "width": w, "height": h,
                    "image_path": str(img_path)  # 硬盘路径，替代 image_bytes
                })
            except:
                pass
        
        # 提取文本
        for para in split_text(page.get_text()):
            text_records.append({
                "doc": doc_idx, "page": pn + 1, "text": para
            })
    
    doc.close()
    log.info(f"  Images: {len(img_records)}, Paragraphs: {len(text_records)}")
    return img_records, text_records


# =============================================================================
# 图片向量化
# =============================================================================
class ImageEncoder:
    def __init__(self, device='cpu'):
        self.device = device
        self.model = models.resnet18(weights=models.ResNet18_Weights.DEFAULT)
        self.model = nn.Sequential(*list(self.model.children())[:-1]).to(device).eval()
        self.transform = transforms.Compose([
            transforms.Resize((128, 128)),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
        ])
        self.feature_dim = 512
    
    def encode_records(self, records, batch_size=32):
        """编码图片记录（从硬盘读取）"""
        vectors = []
        with torch.no_grad():
            for i in range(0, len(records), batch_size):
                batch_tensors = []
                valid = []
                for r in records[i:i+batch_size]:
                    try:
                        img_path = r.get("image_path")
                        if img_path and Path(img_path).exists():
                            img = Image.open(img_path).convert('RGB')
                        else:
                            # 兼容旧版内存数据
                            img = Image.open(io.BytesIO(r["image_bytes"])).convert('RGB')
                        batch_tensors.append(self.transform(img))
                        valid.append(True)
                    except:
                        valid.append(False)
                
                if not batch_tensors:
                    vectors.extend([None] * len(valid))
                    continue
                
                feat = self.model(torch.stack(batch_tensors).to(self.device)).view(len(batch_tensors), -1).cpu().numpy()
                idx = 0
                for v in valid:
                    if v:
                        vectors.append(feat[idx])
                        idx += 1
                    else:
                        vectors.append(None)
        return vectors


# =============================================================================
# 相似度搜索
# =============================================================================
def build_faiss_index(vectors):
    """构建FAISS索引"""
    valid = [v for v in vectors if v is not None]
    if not valid:
        return None, []
    data = np.array(valid, dtype=np.float32)
    faiss.normalize_L2(data)
    index = faiss.IndexFlatIP(data.shape[1])
    index.add(data)
    return index, data


def cross_doc_search(index, data, records, top_k=20, threshold=0.85):
    """跨文档相似度搜索"""
    if index is None or index.ntotal == 0:
        return []
    
    k = min(top_k + 1, index.ntotal)
    D, I = index.search(data, k)
    
    # 建立有效记录索引映射
    valid_records = [r for r in records if r.get("_vector") is not None]
    
    results = []
    seen_pairs = set()
    
    for i in range(len(valid_records)):
        doc_i = valid_records[i]["doc"]
        for j in range(1, k):
            idx = I[i][j]
            if idx < 0 or idx == i:
                continue
            sim = float(D[i][j])
            if sim < threshold:
                continue
            
            doc_j = valid_records[idx]["doc"]
            if doc_i == doc_j:
                continue
            
            pair = tuple(sorted([i, idx]))
            if pair in seen_pairs:
                continue
            seen_pairs.add(pair)
            
            results.append({
                "similarity": round(sim, 4),
                "doc_a": valid_records[i]["doc"], "page_a": valid_records[i]["page"],
                "doc_b": valid_records[idx]["doc"], "page_b": valid_records[idx]["page"],
                "hash_a": valid_records[i].get("hash", ""),
                "hash_b": valid_records[idx].get("hash", ""),
                "size_a": f"{valid_records[i].get('width',0)}x{valid_records[i].get('height',0)}",
                "size_b": f"{valid_records[idx].get('width',0)}x{valid_records[idx].get('height',0)}"
            })
    
    results.sort(key=lambda x: x["similarity"], reverse=True)
    return results


# =============================================================================
# 文本比对 (TF-IDF)
# =============================================================================
def compare_texts(text_records, threshold=0.80):
    """使用TF-IDF进行文本相似度比对"""
    if not text_records:
        return []
    
    texts = [r["text"] for r in text_records]
    vectorizer = TfidfVectorizer(analyzer='char', ngram_range=(2, 4), min_df=1)
    tfidf_matrix = vectorizer.fit_transform(texts)
    
    n = len(text_records)
    batch_size = 100
    seen = set()
    matches = []
    
    for i in range(0, n, batch_size):
        sim_batch = cosine_similarity(tfidf_matrix[i:min(i + batch_size, n)], tfidf_matrix)
        for bi in range(sim_batch.shape[0]):
            idx_i = i + bi
            doc_i = text_records[idx_i]["doc"]
            sim_row = sim_batch[bi]
            
            candidates = []
            for idx_j in range(n):
                if idx_j == idx_i:
                    continue
                if doc_i == text_records[idx_j]["doc"]:
                    continue
                if sim_row[idx_j] >= threshold:
                    candidates.append((idx_j, sim_row[idx_j]))
            
            candidates.sort(key=lambda x: x[1], reverse=True)
            for idx_j, sim in candidates[:10]:
                pair = tuple(sorted([idx_i, idx_j]))
                if pair in seen:
                    continue
                seen.add(pair)
                matches.append({
                    "similarity": round(float(sim), 4),
                    "doc_a": text_records[idx_i]["doc"], "page_a": text_records[idx_i]["page"],
                    "doc_b": text_records[idx_j]["doc"], "page_b": text_records[idx_j]["page"],
                    "text_a": text_records[idx_i]["text"][:200],
                    "text_b": text_records[idx_j]["text"][:200]
                })
    
    matches.sort(key=lambda x: x["similarity"], reverse=True)
    return matches


# =============================================================================
# 报告生成
# =============================================================================
def generate_html_report(img_matches, text_matches, doc_names, threshold_img, threshold_text, output_dir):
    """生成HTML报告"""
    html_path = output_dir / "report.html"
    
    critical_img = len([m for m in img_matches if m["similarity"] >= 0.95])
    high_img = len([m for m in img_matches if 0.90 <= m["similarity"] < 0.95])
    med_img = len([m for m in img_matches if 0.85 <= m["similarity"] < 0.90])
    
    html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>施工方案文档比对报告</title>
<style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{font-family:'Microsoft YaHei',sans-serif;background:linear-gradient(135deg,#667eea,#764ba2);min-height:100vh;padding:20px}}
.container{{max-width:1400px;margin:0 auto}}
h1{{text-align:center;color:#fff;font-size:2.2em;text-shadow:0 2px 10px rgba(0,0,0,0.3)}}
.sub{{text-align:center;color:rgba(255,255,255,0.8);margin-bottom:30px}}
.card{{background:#fff;border-radius:12px;padding:25px;margin:20px 0;box-shadow:0 4px 20px rgba(0,0,0,0.1)}}
h2{{color:#2d3748;border-left:4px solid #667eea;padding-left:12px;margin-bottom:20px}}
.stats{{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:15px}}
.stat{{background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;border-radius:10px;padding:20px;text-align:center}}
.num{{font-size:2.2em;font-weight:bold}}
.label{{font-size:0.9em;opacity:0.9;margin-top:5px}}
table{{width:100%;border-collapse:collapse;font-size:0.9em}}
th{{background:#667eea;color:#fff;padding:12px;text-align:left;position:sticky;top:0}}
td{{padding:10px 12px;border-bottom:1px solid #e2e8f0}}
tr:hover{{background:#f7fafc}}
.sim{{font-weight:bold;font-family:monospace;font-size:1.1em}}
.c1{{color:#e53e3e}}.c2{{color:#dd6b20}}.c3{{color:#3182ce}}.c4{{color:#38a169}}
.tag{{display:inline-block;padding:2px 10px;border-radius:20px;font-size:0.8em;font-weight:bold}}
.d0{{background:#ebf8ff;color:#2b6cb0}}.d1{{background:#fff5f5;color:#c53030}}.d2{{background:#f0fff4;color:#276749}}
.preview{{max-width:400px;color:#4a5568;font-size:0.85em;background:#f7fafc;padding:8px;border-radius:6px;max-height:60px;overflow:hidden}}
.alert{{background:#fff5f5;border:1px solid #feb2b2;border-radius:8px;padding:15px;margin:15px 0;color:#742a2a}}
.alert h3{{color:#c53030;margin-bottom:8px}}
footer{{text-align:center;color:rgba(255,255,255,0.6);padding:30px;font-size:0.85em}}
</style>
</head>
<body>
<div class="container">
<h1>施工方案文档比对报告</h1>
<p class="sub">串标风险排查 | {datetime.now().strftime('%Y-%m-%d %H:%M')}</p>

<div class="card">
<h2>概览</h2>
<div class="stats">
<div class="stat"><div class="num">{len(doc_names)}</div><div class="label">文档数</div></div>
<div class="stat"><div class="num">{len(img_matches)}</div><div class="label">相似图片对</div></div>
<div class="stat"><div class="num">{len(text_matches)}</div><div class="label">相似段落对</div></div>
</div>
</div>

<div class="card">
<h2>图片风险</h2>
<div class="alert">
<h3>极高相似度(>=0.95): {critical_img} 对 | 高相似(0.90-0.95): {high_img} 对 | 中相似(0.85-0.90): {med_img} 对</h3>
</div>
<table><thead><tr><th>#</th><th>相似度</th><th>文档A</th><th>文档B</th><th>尺寸</th></tr></thead><tbody>
"""
    for i,m in enumerate(img_matches[:100],1):
        cl = 'c1' if m["similarity"]>=0.95 else 'c2' if m["similarity"]>=0.90 else 'c3'
        html += f"<tr><td>{i}</td><td class='sim {cl}'>{m['similarity']:.4f}</td><td><span class='tag d{m['doc_a']}'>Doc{m['doc_a']+1}</span> P{m['page_a']}</td><td><span class='tag d{m['doc_b']}'>Doc{m['doc_b']+1}</span> P{m['page_b']}</td><td>{m['size_a']} | {m['size_b']}</td></tr>\n"
    
    html += """</tbody></table></div>

<div class="card">
<h2>文本比对结果</h2>
<table><thead><tr><th>#</th><th>相似度</th><th>文档A</th><th>文档B</th><th>预览</th></tr></thead><tbody>
"""
    for i,m in enumerate(text_matches[:100],1):
        cl = 'c1' if m["similarity"]>=0.95 else 'c2' if m["similarity"]>=0.90 else 'c3'
        ta = m['text_a'][:80].replace('<','&lt;').replace('>','&gt;')
        tb = m['text_b'][:80].replace('<','&lt;').replace('>','&gt;')
        html += f"<tr><td>{i}</td><td class='sim {cl}'>{m['similarity']:.4f}</td><td><span class='tag d{m['doc_a']}'>Doc{m['doc_a']+1}</span> P{m['page_a']}</td><td><span class='tag d{m['doc_b']}'>Doc{m['doc_b']+1}</span> P{m['page_b']}</td><td><div class='preview'>A: {ta}<br>B: {tb}</div></td></tr>\n"
    
    html += """</tbody></table></div>
<footer>BidDocComparator v1.0</footer>
</div></body></html>"""
    
    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(html)
    return html_path


def generate_text_report(img_matches, text_matches, doc_names, output_dir):
    """生成文本报告"""
    txt_path = output_dir / "report.txt"
    lines = []
    lines.append("=" * 80)
    lines.append("施工方案文档比对报告 - 串标风险排查")
    lines.append("=" * 80)
    lines.append(f"时间: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    lines.append(f"文档: {len(doc_names)}")
    for i, name in enumerate(doc_names):
        lines.append(f"  Doc{i+1}: {name}")
    lines.append("")
    lines.append(f"相似图片对: {len(img_matches)}")
    lines.append(f"相似段落对: {len(text_matches)}")
    lines.append("")
    
    lines.append("=" * 80)
    lines.append("图片比对结果 TOP 50")
    lines.append("=" * 80)
    for i, m in enumerate(img_matches[:50], 1):
        lines.append(f"#{i} sim={m['similarity']:.4f} | Doc{m['doc_a']+1}P{m['page_a']}({m['size_a']}) vs Doc{m['doc_b']+1}P{m['page_b']}({m['size_b']})")
    
    lines.append("")
    lines.append("=" * 80)
    lines.append("文本比对结果 TOP 50")
    lines.append("=" * 80)
    for i, m in enumerate(text_matches[:50], 1):
        lines.append(f"#{i} sim={m['similarity']:.4f} | Doc{m['doc_a']+1}P{m['page_a']} vs Doc{m['doc_b']+1}P{m['page_b']}")
        lines.append(f"  A: {m['text_a'][:150]}")
        lines.append(f"  B: {m['text_b'][:150]}")
        lines.append("")
    
    with open(txt_path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
    return txt_path


# =============================================================================
# 主流程
# =============================================================================
def main():
    parser = argparse.ArgumentParser(
        description='施工方案文档比对工具 - 检测PDF中重复的图片和段落',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='示例: python bid_doc_comparator.py --docs a.pdf b.pdf --output ./result'
    )
    parser.add_argument('--docs', nargs='+', default=None, help='PDF文档路径列表（与--workspace二选一）')
    parser.add_argument('--output', default='./bid_compare_result', help='输出目录')
    parser.add_argument('--workspace', default='./workspace', help='PDF文档存放目录（会自动读取该目录下所有PDF）')
    parser.add_argument('--img-threshold', type=float, default=DEFAULT_IMG_THRESHOLD, help='图片相似度阈值')
    parser.add_argument('--text-threshold', type=float, default=DEFAULT_TEXT_THRESHOLD, help='文本相似度阈值')
    parser.add_argument('--device', default=DEFAULT_DEVICE, choices=['cpu', 'cuda'], help='计算设备')
    parser.add_argument('--batch-size', type=int, default=32, help='图片编码批次大小')
    
    args = parser.parse_args()
    
    # 处理 workspace 模式
    if args.docs is None:
        ws = Path(args.workspace)
        if not ws.exists():
            print(f"Error: Workspace not found: {ws}")
            sys.exit(1)
        pdf_files = sorted(ws.glob("*.pdf"))
        if len(pdf_files) < 2:
            print(f"Error: Workspace '{ws}' must contain at least 2 PDF files, found {len(pdf_files)}")
            sys.exit(1)
        args.docs = [str(p) for p in pdf_files]
        print(f"[Workspace] Found {len(args.docs)} PDF files in {ws}")
    
    # 验证文件
    for p in args.docs:
        if not os.path.exists(p):
            print(f"Error: File not found: {p}")
            sys.exit(1)
    if len(args.docs) < 2:
        print("Error: At least 2 documents required")
        sys.exit(1)
    
    # 初始化：清空输出目录（避免旧产物干扰）
    out_dir = Path(args.output)
    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    logger = Logger(out_dir / "compare.log")
    
    logger.info("=" * 60)
    logger.info("BidDocComparator v1.1 Starting")
    logger.info("=" * 60)
    logger.info(f"Documents: {len(args.docs)}")
    logger.info(f"Img threshold: {args.img_threshold}")
    logger.info(f"Text threshold: {args.text_threshold}")
    logger.info(f"Device: {args.device}")
    
    if args.device == 'cuda' and not torch.cuda.is_available():
        logger.warn("CUDA unavailable, fallback to CPU")
        args.device = 'cpu'
    
    t0 = time.time()
    
    # Step 1: 提取内容
    logger.info("\n[Step 1/4] Extracting PDF content...")
    all_img_records = []
    all_text_records = []
    doc_names = []
    
    for idx, path in enumerate(args.docs):
        img_recs, text_recs = extract_pdf_content(path, idx, out_dir, logger)
        all_img_records.extend(img_recs)
        all_text_records.extend(text_recs)
        doc_names.append(Path(path).name)
    
    logger.info(f"Total: {len(all_img_records)} images, {len(all_text_records)} paragraphs")
    
    # Step 2: 图片比对
    logger.info("\n[Step 2/4] Comparing images...")
    img_encoder = ImageEncoder(device=args.device)
    img_vectors = img_encoder.encode_records(all_img_records, batch_size=args.batch_size)
    
    # 标记有效向量
    for i, v in enumerate(img_vectors):
        all_img_records[i]["_vector"] = v is not None
    
    index, data = build_faiss_index(img_vectors)
    img_results = cross_doc_search(index, data, all_img_records, threshold=args.img_threshold)
    logger.info(f"Image matches (>{args.img_threshold}): {len(img_results)}")
    
    # Step 3: 文本比对
    logger.info("\n[Step 3/4] Comparing texts...")
    text_results = compare_texts(all_text_records, threshold=args.text_threshold)
    logger.info(f"Text matches (>{args.text_threshold}): {len(text_results)}")
    
    # Step 4: 生成报告
    logger.info("\n[Step 4/4] Generating reports...")
    
    # JSON
    with open(out_dir / "results.json", 'w', encoding='utf-8') as f:
        json.dump({
            "generated": datetime.now().isoformat(),
            "documents": [{"index": i, "name": n} for i, n in enumerate(doc_names)],
            "image_matches": img_results,
            "text_matches": text_results
        }, f, ensure_ascii=False, indent=2)
    
    # HTML
    html_path = generate_html_report(img_results, text_results, doc_names, args.img_threshold, args.text_threshold, out_dir)
    
    # TXT
    txt_path = generate_text_report(img_results, text_results, doc_names, out_dir)
    
    # Summary
    elapsed = time.time() - t0
    logger.info("\n" + "=" * 60)
    logger.info("COMPLETED")
    logger.info("=" * 60)
    logger.info(f"Time: {elapsed:.1f}s")
    logger.info(f"Image matches: {len(img_results)}")
    logger.info(f"Text matches: {len(text_results)}")
    logger.info(f"Output: {out_dir.absolute()}")
    logger.info(f"  report.html - Visual HTML report")
    logger.info(f"  report.txt  - Text report")
    logger.info(f"  results.json - Detailed JSON data")


if __name__ == "__main__":
    main()
