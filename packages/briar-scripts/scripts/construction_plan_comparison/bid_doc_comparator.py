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


from report_generator import generate_html_report


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

    out_dir = Path(args.output)
    out_dir.mkdir(parents=True, exist_ok=True)
    data_path = out_dir / "report_data.json"
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

    # 保存数据
    logger.info(f"\n保存数据...")
    with open(data_path, 'w', encoding='utf-8') as f:
        json.dump({
            'chunk_size': CHUNK_SIZE,
            'img_threshold': IMG_THRESHOLD,
            'text_threshold': TEXT_THRESHOLD,
            'doc_names': doc_names,
            'all_chunks': all_chunks,
            'img_pairs': img_pairs,
            'text_pairs': text_pairs,
            'special_paras': special_paras,
        }, f, ensure_ascii=False, indent=2)
    logger.info(f"  数据文件: {data_path}")

    # 生成报告
    logger.info(f"\n生成报告...")
    report_path = generate_html_report(img_pairs, text_pairs, special_paras, all_chunks, doc_names, out_dir)

    elapsed = time.time() - t0
    logger.info(f"\n{'=' * 60}")
    logger.info(f"完成! 耗时: {elapsed:.1f}秒")
    logger.info(f"  图片对: {len(img_pairs)}")
    logger.info(f"  文本对: {len(text_pairs)}")
    logger.info(f"  非标段: {len(special_paras)}")
    logger.info(f"  数据: {data_path}")
    logger.info(f"  报告: {report_path}")
    logger.info(f"{'=' * 60}")


if __name__ == "__main__":
    # 强制 Windows 控制台使用 UTF-8 输出，避免中文乱码
    if sys.platform == "win32":
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', line_buffering=True)
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', line_buffering=True)
    main()
