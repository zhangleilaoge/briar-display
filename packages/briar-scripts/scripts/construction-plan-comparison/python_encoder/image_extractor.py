#!/usr/bin/env python3
"""
图片提取器（PyMuPDF）
通过 stdin 接收 JSON：{"pdf_path": str, "doc_idx": int}
通过 stdout 输出 JSON：{"images": [{"doc": int, "page": int, "idx": int, "w": int, "h": int, "base64": str}, ...]}
"""

import base64
import hashlib
import io
import json
import sys

import fitz
from PIL import Image


def extract_images(pdf_path, doc_idx, min_size=32, min_area=0):
    doc = fitz.open(pdf_path)
    all_imgs = []
    seen = set()

    for pn in range(len(doc)):
        for ii, img in enumerate(doc[pn].get_images(full=True)):
            try:
                b = doc.extract_image(img[0])
                w, h = b["width"], b["height"]
                if w < min_size or h < min_size:
                    continue
                if min_area > 0 and w * h < min_area:
                    continue

                hsh = hashlib.md5(b["image"]).hexdigest()
                if hsh in seen:
                    continue
                seen.add(hsh)

                pil = Image.open(io.BytesIO(b["image"])).convert('RGB')
                buf = io.BytesIO()
                pil.save(buf, format='JPEG', quality=48)
                b64 = base64.b64encode(buf.getvalue()).decode('utf-8')

                all_imgs.append({
                    "doc": doc_idx,
                    "page": pn + 1,
                    "idx": ii + 1,
                    "w": w,
                    "h": h,
                    "base64": b64,
                })
            except Exception:
                pass

    doc.close()
    return all_imgs


def main():
    if sys.platform == "win32":
        import io as iolib
        sys.stdout = iolib.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', line_buffering=True)
        sys.stderr = iolib.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', line_buffering=True)

    input_data = json.load(sys.stdin)
    pdf_path = input_data.get('pdf_path')
    doc_idx = input_data.get('doc_idx', 0)
    min_size = input_data.get('min_size', 32)
    min_area = input_data.get('min_area', 0)

    images = extract_images(pdf_path, doc_idx, min_size, min_area)
    json.dump({"images": images}, sys.stdout, ensure_ascii=False)


if __name__ == '__main__':
    main()
