#!/usr/bin/env python3
"""
============================================================
报告生成器 - 从 JSON 数据生成 HTML 比对报告
============================================================
用法:
    python generate_report.py --data ./bid_compare_result/report_data.json
    python generate_report.py --data ./bid_compare_result/report_data.json --output ./report.html
============================================================
"""

import argparse
import json
import sys
from pathlib import Path

from report_generator import generate_html_report


def main():
    parser = argparse.ArgumentParser(description='从比对数据生成 HTML 报告')
    parser.add_argument('--data', default='./bid_compare_result/report_data.json', help='report_data.json 文件路径（默认: ./bid_compare_result/report_data.json）')
    parser.add_argument('--output', default=None, help='输出目录（默认使用数据文件所在目录）')
    args = parser.parse_args()

    data_path = Path(args.data)
    if not data_path.exists():
        print(f"错误：数据文件不存在: {data_path}")
        sys.exit(1)

    if args.output:
        output_dir = Path(args.output)
    else:
        output_dir = data_path.parent

    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"[报告生成] 读取数据: {data_path}")
    with open(data_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    chunk_size = data.get('chunk_size', 300)
    doc_names = data['doc_names']
    all_chunks = data['all_chunks']
    img_pairs = data['img_pairs']
    text_pairs = data['text_pairs']
    special_paras = data['special_paras']

    report_path = generate_html_report(
        img_pairs,
        text_pairs,
        special_paras,
        all_chunks,
        doc_names,
        output_dir,
        chunk_size=chunk_size,
    )
    print(f"[报告生成] 报告已生成: {report_path}")


if __name__ == "__main__":
    if sys.platform == "win32":
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', line_buffering=True)
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', line_buffering=True)
    main()
