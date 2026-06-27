#!/usr/bin/env python3
"""
图片特征编码器（PyTorch ResNet18）
长驻子进程模式：从 stdin 逐行读取 batch JSON，处理后将 embeddings 逐行写入 stdout。

输入（每行一个 JSON 对象）:
    {"images": [{"doc": int, "page": int, "idx": int, "base64": str}, ...]}

输出（每行一个 JSON 对象）:
    {"embeddings": [{"doc": int, "page": int, "idx": int, "embedding": [float, ...]}, ...]}

stdin 关闭或收到空输入时进程退出。
"""

import base64
import io
import json
import sys

import numpy as np
import torch
import torch.nn as nn
from PIL import Image
from torchvision import models, transforms


def build_encoder(device):
    resnet = models.resnet18(weights=models.ResNet18_Weights.DEFAULT)
    encoder = nn.Sequential(*list(resnet.children())[:-1]).to(device).eval()

    preprocess = transforms.Compose([
        transforms.Resize((128, 128)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])
    return encoder, preprocess


def encode_batch(encoder, preprocess, image_list, device):
    embeddings = []
    with torch.no_grad():
        for item in image_list:
            try:
                buf = base64.b64decode(item['base64'])
                pil = Image.open(io.BytesIO(buf)).convert('RGB')
                t = preprocess(pil).unsqueeze(0).to(device)
                vec = encoder(t).view(-1).cpu().numpy()
                embeddings.append({
                    'doc': item['doc'],
                    'page': item['page'],
                    'idx': item['idx'],
                    'embedding': vec.tolist(),
                })
            except Exception:
                # 跳过无法处理的图片
                pass
    return embeddings


def main():
    # Windows 控制台 UTF-8
    if sys.platform == "win32":
        import io as iolib
        sys.stdout = iolib.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', line_buffering=True)
        sys.stderr = iolib.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', line_buffering=True)

    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    encoder, preprocess = build_encoder(device)

    # 通知 TS 端模型已加载（可选，便于调试）
    print(json.dumps({'status': 'ready', 'device': device}, ensure_ascii=False), flush=True)

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            input_data = json.loads(line)
            image_list = input_data.get('images', [])
            embeddings = encode_batch(encoder, preprocess, image_list, device)
            print(json.dumps({'embeddings': embeddings}, ensure_ascii=False), flush=True)
        except Exception as e:
            print(json.dumps({'error': str(e)}, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()
