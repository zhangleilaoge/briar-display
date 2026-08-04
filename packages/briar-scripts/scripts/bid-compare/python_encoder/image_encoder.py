#!/usr/bin/env python3
"""
图片特征编码器（PyTorch ResNet18）
长驻子进程模式：从 stdin 逐行读取 batch JSON，处理后将 embeddings 逐行写入 stdout。

输入（每行一个 JSON 对象）:
    {"images": [{"doc": int, "page": int, "idx": int, "path": str, "width": int, "height": int}, ...]}

输出（每行一个 JSON 对象）:
    {"embeddings": [{"doc": int, "page": int, "idx": int, "embedding": [float, ...]}, ...]}

stdin 关闭或收到空输入时进程退出。
"""

import json
import signal
import sys
import traceback

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
                img_path = item['path']
                pil = Image.open(img_path).convert('RGB')
                t = preprocess(pil).unsqueeze(0).to(device)
                vec = encoder(t).view(-1).cpu().numpy()
                embeddings.append({
                    'doc': item['doc'],
                    'page': item['page'],
                    'idx': item['idx'],
                    'embedding': vec.tolist(),
                })
            except Exception as e:
                # 跳过无法处理的图片，并把原因输出到 stderr 便于排查
                print(f"Encode failed for {item.get('path', item)}: {e}", file=sys.stderr, flush=True)
    return embeddings


def main():
    # Windows 控制台 UTF-8：使用 reconfigure 避免重复包装 stdout 导致管道缓冲异常
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')

    try:
        device = 'cuda' if torch.cuda.is_available() else 'cpu'
        encoder, preprocess = build_encoder(device)
    except Exception as e:
        print(f"Failed to initialize encoder: {e}", file=sys.stderr, flush=True)
        traceback.print_exc(file=sys.stderr)
        print(json.dumps({'error': f'Encoder init failed: {e}'}, ensure_ascii=False), flush=True)
        sys.exit(1)

    # 通知 TS 端模型已加载（可选，便于调试）
    print(json.dumps({'status': 'ready', 'device': device}, ensure_ascii=False), flush=True)

    # 忽略 SIGPIPE（Windows 不支持，但加一层防护）
    try:
        signal.signal(signal.SIGPIPE, signal.SIG_DFL)
    except (AttributeError, ValueError):
        pass

    try:
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue
            try:
                input_data = json.loads(line)
                image_list = input_data.get('images', [])
                embeddings = encode_batch(encoder, preprocess, image_list, device)
                print(json.dumps({'embeddings': embeddings}, ensure_ascii=False), flush=True)
            except json.JSONDecodeError as e:
                print(f"Invalid JSON input: {e}", file=sys.stderr, flush=True)
                print(json.dumps({'error': f'Invalid JSON: {e}'}, ensure_ascii=False), flush=True)
            except Exception as e:
                print(f"Batch processing error: {e}", file=sys.stderr, flush=True)
                traceback.print_exc(file=sys.stderr)
                print(json.dumps({'error': str(e)}, ensure_ascii=False), flush=True)
    except KeyboardInterrupt:
        print("Encoder interrupted", file=sys.stderr, flush=True)
    except Exception as e:
        print(f"Fatal encoder error: {e}", file=sys.stderr, flush=True)
        traceback.print_exc(file=sys.stderr)
        print(json.dumps({'error': f'Fatal: {e}'}, ensure_ascii=False), flush=True)
        sys.exit(1)


if __name__ == '__main__':
    main()
