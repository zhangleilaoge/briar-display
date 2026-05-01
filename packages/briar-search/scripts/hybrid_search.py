#!/usr/bin/env python3
"""
Briar Hybrid Search — 混合检索（Zoekt BM25 + Qdrant 向量语义）

一期（Zoekt）与二期（向量）的融合查询：
1. Zoekt 负责快速关键词/正则召回
2. Qdrant 负责语义相似度精排
3. 业务域标签负责筛选过滤

用法:
    python hybrid_search.py "导购换绑"
    python hybrid_search.py -d 导购 "rebind"
    python hybrid_search.py -d CRM -l go "客户归属查询"
"""

import argparse
import json
import os
import re
import urllib.request
from pathlib import Path
from typing import Any

try:
    from fastembed import TextEmbedding
except ImportError:
    TextEmbedding = None

try:
    from qdrant_client import QdrantClient
except ImportError:
    QdrantClient = None

# 配置
CONFIG_DIR = Path(__file__).parent.parent / "config"
ZOEKT_HOST = os.environ.get("ZOEKT_HOST", "http://localhost:6070")
QDRANT_HOST = os.environ.get("QDRANT_HOST", "http://localhost:6333")
COLLECTION_NAME = "briar_code"
EMBEDDING_MODEL = "BAAI/bge-small-en-v1.5"


def load_domains() -> dict[str, Any]:
    """加载业务域规则"""
    domains_file = CONFIG_DIR / "domains.json"
    if not domains_file.exists():
        return {}
    with open(domains_file, "r", encoding="utf-8") as f:
        return json.load(f)


def get_repo_patterns_for_domain(domain: str, domains_config: dict) -> list[str]:
    """获取业务域对应的仓库通配模式"""
    return domains_config.get("domains", {}).get(domain, {}).get("repo_patterns", [])


def zoekt_search(query: str, num_results: int = 50) -> list[dict]:
    """调用 Zoekt API 进行全文搜索"""
    url = f"{ZOEKT_HOST}/api/search"
    payload = json.dumps({"q": query, "num": num_results}).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("ResultFiles", [])
    except Exception:
        try:
            encoded = urllib.parse.quote(query)
            url = f"{ZOEKT_HOST}/search?q={encoded}&num={num_results}"
            with urllib.request.urlopen(url, timeout=30) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                return data.get("ResultFiles", [])
        except Exception:
            return []


def qdrant_search(
    query: str,
    embedding_model: Any,
    qdrant_client: Any,
    domain: str = "",
    num_results: int = 20,
) -> list[dict]:
    """调用 Qdrant 进行向量语义搜索"""
    try:
        vectors = list(embedding_model.embed([query]))
        vector = vectors[0].tolist()
    except Exception:
        return []

    # 构建过滤条件
    filter_conditions = None
    if domain:
        filter_conditions = {
            "must": [{"key": "domains", "match": {"value": domain}}]
        }

    try:
        results = qdrant_client.search(
            collection_name=COLLECTION_NAME,
            query_vector=vector,
            query_filter=filter_conditions,
            limit=num_results,
            with_payload=True,
        )
        return [
            {
                "id": r.id,
                "score": r.score,
                "repository": r.payload.get("repository", ""),
                "file_path": r.payload.get("file_path", ""),
                "absolute_path": r.payload.get("absolute_path", ""),
                "language": r.payload.get("language", ""),
                "block_type": r.payload.get("block_type", ""),
                "signature": r.payload.get("signature", ""),
                "content": r.payload.get("content", ""),
                "domains": r.payload.get("domains", []),
            }
            for r in results
        ]
    except Exception as e:
        print(f"Qdrant 查询失败: {e}")
        return []


def merge_results(
    zoekt_results: list[dict],
    qdrant_results: list[dict],
    alpha: float = 0.5,
    num_final: int = 20,
) -> list[dict]:
    """融合 Zoekt 和 Qdrant 结果

    alpha: Zoekt 结果权重（0-1），1-alpha 为 Qdrant 权重
    """
    merged = {}

    # Zoekt 结果打分（基于排名）
    for rank, file_info in enumerate(zoekt_results):
        repo = file_info.get("Repository", "")
        filename = file_info.get("FileName", "")
        key = f"{repo}/{filename}"
        score = 1.0 / (rank + 1)  # 排名越靠前分数越高
        merged[key] = {
            "key": key,
            "repository": repo,
            "file_path": filename,
            "language": file_info.get("Language", ""),
            "zoekt_score": score,
            "qdrant_score": 0.0,
            "content": "",
            "signature": "",
            "source": "zoekt",
        }

    # Qdrant 结果打分
    for item in qdrant_results:
        key = f"{item['repository']}/{item['file_path']}"
        if key in merged:
            merged[key]["qdrant_score"] = item["score"]
            merged[key]["content"] = item["content"]
            merged[key]["signature"] = item["signature"]
            merged[key]["source"] = "both"
        else:
            merged[key] = {
                "key": key,
                "repository": item["repository"],
                "file_path": item["file_path"],
                "language": item["language"],
                "zoekt_score": 0.0,
                "qdrant_score": item["score"],
                "content": item["content"],
                "signature": item["signature"],
                "source": "qdrant",
            }

    # 加权融合排序
    for item in merged.values():
        # 归一化 qdrant_score（假设最大约 1.0）
        q_score = min(item["qdrant_score"], 1.0)
        z_score = min(item["zoekt_score"], 1.0)
        item["final_score"] = alpha * z_score + (1 - alpha) * q_score

    sorted_results = sorted(merged.values(), key=lambda x: x["final_score"], reverse=True)
    return sorted_results[:num_final]


def format_results(results: list[dict]) -> str:
    """格式化输出"""
    if not results:
        return "未找到匹配结果"

    lines = [f"找到 {len(results)} 个结果（混合排序）:\n"]

    for i, r in enumerate(results, 1):
        source_icon = {"zoekt": "🔍", "qdrant": "🧠", "both": "⚡"}.get(
            r["source"], "?"
        )
        lines.append(f"\n{'=' * 50}")
        lines.append(f"{i}. {source_icon} {r['repository']}/{r['file_path']}")
        lines.append(f"   语言: {r['language']} | 得分: {r['final_score']:.3f}")
        if r["signature"]:
            lines.append(f"   📌 {r['signature'][:150]}")
        if r["content"]:
            content = r["content"].replace("\n", " ")[:200]
            lines.append(f"   📝 {content}...")

    return "\n".join(lines)


def query_rewrite(query: str, domains_config: dict) -> str:
    """查询改写：将自然语言扩展为包含代码符号的查询"""
    # 简单规则：将中文关键词替换/补充为常见代码对应词
    expansions = {
        "换绑": "rebind",
        "导购": "guide guider",
        "客户": "customer client",
        "支付": "pay payment",
        "订单": "order",
        "退款": "refund",
        "库存": "stock inventory",
        "商品": "product goods item sku",
        "用户": "user",
        "查询": "query search get",
        "更新": "update put",
        "创建": "create post add",
        "删除": "delete remove",
    }

    expanded = query
    for cn, en in expansions.items():
        if cn in query:
            expanded += f" {en}"

    return expanded


def main():
    parser = argparse.ArgumentParser(description="Briar 混合检索（Zoekt + Qdrant）")
    parser.add_argument("query", help="搜索查询语句")
    parser.add_argument("-d", "--domain", help="业务域筛选")
    parser.add_argument("-l", "--language", help="编程语言筛选")
    parser.add_argument("-n", "--num", type=int, default=20, help="结果数量")
    parser.add_argument("--alpha", type=float, default=0.5, help="Zoekt 权重 (0-1)")
    parser.add_argument("--json", action="store_true", help="JSON 输出")
    parser.add_argument("--zoekt-only", action="store_true", help="仅 Zoekt")
    parser.add_argument("--semantic-only", action="store_true", help="仅语义搜索")
    parser.add_argument("--qdrant-host", default=QDRANT_HOST, help="Qdrant 地址")
    args = parser.parse_args()

    domains_config = load_domains()

    # 构建 Zoekt 查询
    zoekt_query = args.query
    if args.domain:
        patterns = get_repo_patterns_for_domain(args.domain, domains_config)
        if patterns:
            repo_clause = " OR ".join(f"repo:{p}" for p in patterns)
            zoekt_query += f" AND ({repo_clause})"
    if args.language:
        zoekt_query += f" AND lang:{args.language}"

    # 改写查询用于语义搜索
    semantic_query = query_rewrite(args.query, domains_config)

    results = []

    if args.zoekt_only:
        print(f"[Zoekt 查询: {zoekt_query}]")
        zoekt_results = zoekt_search(zoekt_query, num_results=args.num * 2)
        results = [
            {
                "key": f"{r.get('Repository', '')}/{r.get('FileName', '')}",
                "repository": r.get("Repository", ""),
                "file_path": r.get("FileName", ""),
                "language": r.get("Language", ""),
                "final_score": 1.0 / (i + 1),
                "source": "zoekt",
                "signature": "",
                "content": "",
            }
            for i, r in enumerate(zoekt_results)
        ][: args.num]
    elif args.semantic_only:
        if not TextEmbedding or not QdrantClient:
            print("错误: 缺少依赖。请安装: pip install fastembed qdrant-client")
            return 1
        print(f"[语义查询: {semantic_query}]")
        embedding_model = TextEmbedding(model_name=EMBEDDING_MODEL)
        qdrant_client = QdrantClient(url=args.qdrant_host)
        results = qdrant_search(
            semantic_query,
            embedding_model,
            qdrant_client,
            domain=args.domain,
            num_results=args.num,
        )
        for r in results:
            r["final_score"] = r["score"]
    else:
        # 混合模式
        print(f"[Zoekt 查询: {zoekt_query}]")
        print(f"[语义查询: {semantic_query}]")

        zoekt_results = zoekt_search(zoekt_query, num_results=50)

        qdrant_results = []
        if TextEmbedding and QdrantClient:
            try:
                embedding_model = TextEmbedding(model_name=EMBEDDING_MODEL)
                qdrant_client = QdrantClient(url=args.qdrant_host)
                qdrant_results = qdrant_search(
                    semantic_query,
                    embedding_model,
                    qdrant_client,
                    domain=args.domain,
                    num_results=50,
                )
            except Exception as e:
                print(f"Qdrant 查询失败，退化为 Zoekt 模式: {e}")
        else:
            print("语义搜索依赖未安装，仅使用 Zoekt 结果")

        results = merge_results(
            zoekt_results, qdrant_results, alpha=args.alpha, num_final=args.num
        )

    if args.json:
        print(json.dumps(results, ensure_ascii=False, indent=2))
    else:
        print(format_results(results))

    return 0


if __name__ == "__main__":
    exit(main())
