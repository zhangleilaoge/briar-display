#!/usr/bin/env python3
"""
PDF 文本与表格提取器（PyMuPDF）
从 stdin 读取 PDF 路径等参数，向 stdout 输出 JSON。

输入:
    {"pdf_path": str, "doc_idx": int, "chunk_size": int, "chunk_overlap": int}

输出:
    {
        "chunks": [
            {"page": int, "type": "text"|"table", "text": str},
            ...
        ]
    }
"""

import json
import re
import sys
import warnings

import fitz

# 抑制 PyMuPDF 等库的运行时警告，避免污染 stdout
warnings.filterwarnings('ignore')


def rfind_in_range(text, sep, search_start, search_end):
    substr = text[search_start:search_end]
    pos = substr.rfind(sep)
    if pos == -1:
        return -1
    return search_start + pos


def split_fixed(text, chunk_size=300, overlap=30):
    """固定长度拆分文本（与 TS 版本一致）"""
    raw_paras = re.split(r'\n{2,}', text)
    chunks = []
    seps = ['。', '；', '！', '？', '. ', '; ', '! ', '? ', '，', ', ']

    for para in raw_paras:
        cleaned = ' '.join(para.split()).strip()
        if len(cleaned) < 20:
            continue

        if len(cleaned) <= chunk_size:
            chunks.append(cleaned)
        else:
            start = 0
            while start < len(cleaned):
                end = min(start + chunk_size, len(cleaned))
                if end < len(cleaned):
                    search_start = start + chunk_size // 2
                    for sep in seps:
                        pos = rfind_in_range(cleaned, sep, search_start, end)
                        if pos >= search_start:
                            end = pos + len(sep)
                            break

                chunk = cleaned[start:end].strip()
                if len(chunk) >= 20:
                    chunks.append(chunk)

                next_start = end - overlap
                if next_start <= start:
                    start = end
                else:
                    start = next_start
                if start >= len(cleaned):
                    break
    return chunks


def extract_tables(page):
    """提取页面中的表格，返回结构化表格列表

    每个元素:
        {
            'rows': [[cell, ...], ...],
            'markdown': 'Markdown 表示'
        }
    """
    tables = []
    try:
        tab_finder = page.find_tables()
        for tab in tab_finder.tables:
            rows = tab.extract()
            if not rows:
                continue
            normalized_rows = []
            for row in rows:
                cells = [str(cell or '').replace('|', '\\|').strip() for cell in row]
                normalized_rows.append(cells)
            if normalized_rows:
                lines = ['| ' + ' | '.join(row) + ' |' for row in normalized_rows]
                tables.append({
                    'rows': normalized_rows,
                    'markdown': '\n'.join(lines),
                })
    except Exception:
        pass
    return tables


def extract_texts(pdf_path, doc_idx, chunk_size=300, chunk_overlap=30):
    try:
        doc = fitz.open(pdf_path)
    except Exception as e:
        return {'error': f'无法打开 PDF（可能已损坏）: {e}', 'chunks': [], 'tables': []}

    if doc.is_encrypted:
        doc.close()
        return {'error': 'PDF 已加密，请先解密后再比对', 'chunks': [], 'tables': []}

    chunks = []
    tables = []
    total_text_chars = 0

    try:
        for page_num, page in enumerate(doc, start=1):
            # 文本
            text = page.get_text()
            total_text_chars += len(text.strip())
            if text.strip():
                for chunk in split_fixed(text, chunk_size, chunk_overlap):
                    chunks.append({
                        'page': page_num,
                        'type': 'text',
                        'text': chunk,
                    })

            # 表格：保留 Markdown chunk 用于文本比对，同时输出结构化表格
            for table in extract_tables(page):
                chunks.append({
                    'page': page_num,
                    'type': 'table',
                    'text': table['markdown'],
                })
                tables.append({
                    'page': page_num,
                    'rows': table['rows'],
                })
    except Exception as e:
        doc.close()
        return {'error': f'提取文本/表格时出错: {e}', 'chunks': chunks, 'tables': tables}

    doc.close()

    warning = None
    if total_text_chars == 0 and len(chunks) == 0:
        warning = '未提取到任何文本，可能是扫描件或纯图片 PDF，建议启用 OCR'

    result = {'chunks': chunks, 'tables': tables}
    if warning:
        result['warning'] = warning
    return result


def main():
    input_data = json.loads(sys.stdin.read())
    pdf_path = input_data['pdf_path']
    doc_idx = input_data.get('doc_idx', 0)
    chunk_size = input_data.get('chunk_size', 300)
    chunk_overlap = input_data.get('chunk_overlap', 30)

    result = extract_texts(pdf_path, doc_idx, chunk_size, chunk_overlap)
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    main()
