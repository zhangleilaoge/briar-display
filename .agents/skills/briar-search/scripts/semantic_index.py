#!/usr/bin/env python3
"""
Briar Semantic Index — 二期语义向量索引
基于 Tree-sitter AST 提取 + FastEmbed 向量化
将代码块存入 Qdrant 向量数据库

依赖安装:
    pip install fastembed qdrant-client tree-sitter tree-sitter-python tree-sitter-java tree-sitter-go

用法:
    python semantic_index.py /repos/guide-service
    python semantic_index.py -d /repos --domain 导购
"""

import argparse
import hashlib
import json
import os
import re
import subprocess
from pathlib import Path
from typing import Any

# 可选依赖，未安装时给出友好提示
try:
    from fastembed import TextEmbedding
except ImportError:
    TextEmbedding = None

try:
    from qdrant_client import QdrantClient
    from qdrant_client.models import Distance, PointStruct, VectorParams
except ImportError:
    QdrantClient = None

# Tree-sitter 语言支持（可选）
try:
    from tree_sitter import Language, Parser
except ImportError:
    Language = None
    Parser = None

# 配置
CONFIG_DIR = Path(__file__).parent.parent / "config"
QDRANT_HOST = os.environ.get("QDRANT_HOST", "http://localhost:6333")
COLLECTION_NAME = "briar_code"
EMBEDDING_MODEL = "BAAI/bge-small-en-v1.5"  # FastEmbed 内置模型，代码友好

# 文件扩展名到语言的映射
EXT_TO_LANG = {
    ".py": "python",
    ".java": "java",
    ".go": "go",
    ".js": "javascript",
    ".ts": "typescript",
    ".jsx": "javascript",
    ".tsx": "typescript",
    ".rb": "ruby",
    ".rs": "rust",
    ".cpp": "cpp",
    ".c": "c",
    ".h": "c",
    ".cs": "csharp",
    ".php": "php",
}


def load_domains() -> dict[str, Any]:
    """加载业务域规则"""
    domains_file = CONFIG_DIR / "domains.json"
    if not domains_file.exists():
        return {}
    with open(domains_file, "r", encoding="utf-8") as f:
        return json.load(f)


def match_repo_domain(repo_name: str, domains_config: dict) -> list[str]:
    """匹配仓库所属业务域"""
    from fnmatch import fnmatch

    tags = []
    for domain, rules in domains_config.get("domains", {}).items():
        for pattern in rules.get("repo_patterns", []):
            if fnmatch(repo_name, pattern):
                tags.append(domain)
                break
    return tags


def extract_code_blocks_simple(file_path: Path, content: str) -> list[dict]:
    """简化版代码分块：按函数/类定义正则提取"""
    blocks = []
    lang = EXT_TO_LANG.get(file_path.suffix, "unknown")

    # 尝试按函数定义分割
    # Python / Go / Java / JS / TS 的函数定义模式
    patterns = [
        # Python: def funcname(...)
        (r"^(def\s+\w+\s*\(.*\)(\s*->\s*[^:]+)?:.*?)(?=\n(def\s+|class\s+|\Z))", "function"),
        # Python: class ClassName(...)
        (r"^(class\s+\w+.*?:.*?)(?=\n(class\s+|def\s+|\Z))", "class"),
        # Go: func FuncName(...)
        (r"^(func\s+(\([^)]*\)\s*)?\w+\s*\(.*?(\{.*?\}|\Z))", "function"),
        # Go: type StructName struct { ... }
        (r"^(type\s+\w+\s+struct\s*\{.*?\})", "struct"),
        # Java: public/private/... Type methodName(...) { ... }
        (r"^((public|private|protected|static|\s)+[\w<>\[\]]+\s+\w+\s*\([^)]*\)\s*\{.*?\})", "method"),
        # Java: public/private/... class ClassName { ... }
        (r"^((public|private|protected|static|\s)*class\s+\w+.*?\{.*?\})", "class"),
        # JS/TS: function name(...) { ... }
        (r"^(function\s+\w+\s*\(.*?(\{.*?\}|=>.*?;))", "function"),
        # JS/TS: const/let/var name = (...) => { ... }
        (r"^((const|let|var)\s+\w+\s*=\s*.*?=>\s*\{.*?\})", "function"),
        # JS/TS: class Name { ... }
        (r"^(class\s+\w+.*?\{.*?\})", "class"),
    ]

    for pattern, block_type in patterns:
        for match in re.finditer(pattern, content, re.MULTILINE | re.DOTALL):
            block_content = match.group(1).strip()
            if len(block_content) < 20:
                continue
            # 提取第一行作为签名
            lines = block_content.split("\n")
            signature = lines[0].strip()[:200]
            blocks.append(
                {
                    "type": block_type,
                    "signature": signature,
                    "content": block_content[:2000],  # 限制长度
                    "language": lang,
                }
            )

    # 如果没有提取到任何块，整个文件作为一个块
    if not blocks:
        blocks.append(
            {
                "type": "file",
                "signature": f"{file_path.name}",
                "content": content[:2000],
                "language": lang,
            }
        )

    return blocks


def enhance_with_domain_tags(content: str, domains: list[str], block_type: str) -> str:
    """在文本前注入业务域标签，增强语义关联"""
    tags = []
    for d in domains:
        tags.append(f"[业务域:{d}]")
    tags.append(f"[类型:{block_type}]")
    return " ".join(tags) + " " + content


def index_repository(
    repo_path: Path,
    embedding_model: Any,
    qdrant_client: Any,
    domains_config: dict,
):
    """索引单个仓库"""
    repo_name = repo_path.name
    domains = match_repo_domain(repo_name, domains_config)

    print(f"索引仓库: {repo_name} {'[' + ','.join(domains) + ']' if domains else ''}")

    points = []
    count = 0

    # 遍历仓库中的代码文件
    for ext in EXT_TO_LANG.keys():
        for file_path in repo_path.rglob(f"*{ext}"):
            # 跳过常见非业务目录
            if any(part.startswith(("vendor", "node_modules", ".git", "dist", "build", "target")) for part in file_path.parts):
                continue

            try:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
            except Exception:
                continue

            if len(content) < 50:
                continue

            blocks = extract_code_blocks_simple(file_path, content)

            for block in blocks:
                enhanced_text = enhance_with_domain_tags(
                    block["content"], domains, block["type"]
                )

                # 生成向量
                try:
                    vectors = list(embedding_model.embed([enhanced_text]))
                    vector = vectors[0].tolist()
                except Exception as e:
                    print(f"  向量化失败 {file_path}: {e}")
                    continue

                # 生成唯一 ID
                doc_id = hashlib.md5(
                    f"{repo_name}:{file_path}:{block['signature']}".encode()
                ).hexdigest()

                point = PointStruct(
                    id=doc_id,
                    vector=vector,
                    payload={
                        "repository": repo_name,
                        "file_path": str(file_path.relative_to(repo_path)),
                        "absolute_path": str(file_path),
                        "language": block["language"],
                        "block_type": block["type"],
                        "signature": block["signature"],
                        "content": block["content"],
                        "domains": domains,
                    },
                )
                points.append(point)
                count += 1

                # 批量上传
                if len(points) >= 100:
                    qdrant_client.upsert(collection_name=COLLECTION_NAME, points=points)
                    print(f"  已索引 {count} 个代码块...")
                    points = []

    # 上传剩余
    if points:
        qdrant_client.upsert(collection_name=COLLECTION_NAME, points=points)

    print(f"  完成: {count} 个代码块")
    return count


def ensure_collection(qdrant_client: Any):
    """确保 Qdrant Collection 存在"""
    try:
        qdrant_client.get_collection(COLLECTION_NAME)
        print(f"Collection '{COLLECTION_NAME}' 已存在")
    except Exception:
        print(f"创建 Collection '{COLLECTION_NAME}'...")
        # FastEmbed 默认输出维度
        dim = 384  # bge-small-en-v1.5
        qdrant_client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=dim, distance=Distance.COSINE),
        )


def main():
    parser = argparse.ArgumentParser(description="Briar 语义向量索引")
    parser.add_argument("paths", nargs="*", help="仓库路径")
    parser.add_argument("-d", "--directory", help="批量索引目录下所有仓库")
    parser.add_argument("--domain", help="强制指定业务域标签")
    parser.add_argument("--qdrant-host", default=QDRANT_HOST, help="Qdrant 地址")
    parser.add_argument("--collection", default=COLLECTION_NAME, help="Collection 名称")
    args = parser.parse_args()

    if not TextEmbedding or not QdrantClient:
        print("错误: 缺少依赖。请安装:")
        print("  pip install fastembed qdrant-client")
        return 1

    print("加载嵌入模型...")
    embedding_model = TextEmbedding(model_name=EMBEDDING_MODEL)

    print(f"连接 Qdrant: {args.qdrant_host}")
    qdrant_client = QdrantClient(url=args.qdrant_host)
    ensure_collection(qdrant_client)

    domains_config = load_domains()

    repos = []
    if args.directory:
        for item in Path(args.directory).iterdir():
            if item.is_dir() and (item / ".git").exists():
                repos.append(item)
    for p in args.paths:
        path = Path(p)
        if path.is_dir() and (path / ".git").exists():
            repos.append(path)

    if not repos:
        print("未找到任何 Git 仓库")
        return 1

    total = 0
    for repo in repos:
        total += index_repository(repo, embedding_model, qdrant_client, domains_config)

    print(f"\n全部完成，共索引 {total} 个代码块")
    return 0


if __name__ == "__main__":
    exit(main())
