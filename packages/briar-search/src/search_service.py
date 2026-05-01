#!/usr/bin/env python3
"""
Briar Search Service
基于 Zoekt 的代码搜索引擎服务层
支持业务域筛选、仓库过滤、结果格式化
"""

import json
import os
import re
import subprocess
import sys
import urllib.parse
import urllib.request
from fnmatch import fnmatch
from pathlib import Path
from typing import Any

# 配置
CONFIG_DIR = Path(__file__).parent.parent / "config"
ZOEKT_HOST = os.environ.get("ZOEKT_HOST", "http://localhost:6070")
ZOEKT_INDEX_DIR = os.environ.get("ZOEKT_INDEX_DIR", str(Path.home() / ".zoekt"))


def load_domains() -> dict[str, Any]:
    """加载业务域规则配置"""
    domains_file = CONFIG_DIR / "domains.json"
    if not domains_file.exists():
        return {}
    with open(domains_file, "r", encoding="utf-8") as f:
        return json.load(f)


def get_repo_patterns_for_domain(domain: str, domains_config: dict) -> list[str]:
    """获取指定业务域对应的仓库名通配模式"""
    domain_rules = domains_config.get("domains", {}).get(domain, {})
    return domain_rules.get("repo_patterns", [])


def match_repo_to_domain(repo_name: str, domain: str, domains_config: dict) -> bool:
    """判断仓库名是否匹配指定业务域"""
    patterns = get_repo_patterns_for_domain(domain, domains_config)
    for pattern in patterns:
        if fnmatch(repo_name, pattern):
            return True
    return False


def build_zoekt_query(
    query: str,
    domain: str = "",
    repo_filter: str = "",
    language: str = "",
    file_pattern: str = "",
    domains_config: dict | None = None,
) -> str:
    """构建 Zoekt 查询语法"""
    parts = [query]

    # 业务域筛选
    if domain:
        if domains_config is None:
            domains_config = load_domains()
        patterns = get_repo_patterns_for_domain(domain, domains_config)
        if patterns:
            repo_clauses = [f"repo:{p}" for p in patterns]
            parts.append(f"({' OR '.join(repo_clauses)})")

    # 仓库筛选
    if repo_filter:
        parts.append(f"repo:{repo_filter}")

    # 语言筛选
    if language:
        parts.append(f"lang:{language}")

    # 文件筛选
    if file_pattern:
        parts.append(f"file:{file_pattern}")

    return " AND ".join(parts)


def search_via_api(query: str, num_results: int = 20) -> dict:
    """通过 Zoekt HTTP API 搜索"""
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
            return json.loads(resp.read().decode("utf-8"))
    except Exception:
        # 尝试 GET
        try:
            encoded = urllib.parse.quote(query)
            url = f"{ZOEKT_HOST}/search?q={encoded}&num={num_results}"
            with urllib.request.urlopen(url, timeout=30) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception as e:
            return {"error": str(e)}


def search_via_cli(query: str, num_results: int = 20) -> str:
    """通过本地 zoekt 命令搜索"""
    try:
        result = subprocess.run(
            ["zoekt", "-index_dir", ZOEKT_INDEX_DIR, "-max_hits", str(num_results), query],
            capture_output=True,
            text=True,
            timeout=30,
        )
        return result.stdout
    except Exception as e:
        return f"Error: {e}"


def format_results(results: dict, verbose: bool = False) -> str:
    """格式化搜索结果为人类可读形式"""
    if "error" in results:
        return f"搜索出错: {results['error']}"

    files = results.get("ResultFiles", [])
    if not files:
        return "未找到匹配结果"

    lines = [f"找到 {len(files)} 个文件:\n"]

    for f in files:
        repo = f.get("Repository", "unknown")
        filename = f.get("FileName", "unknown")
        lang = f.get("Language", "unknown")
        line_matches = f.get("LineMatches", [])

        lines.append(f"\n{'=' * 50}")
        lines.append(f"📁 {repo}/{filename}")
        lines.append(f"   语言: {lang} | 匹配: {len(line_matches)} 处")

        if verbose:
            for lm in line_matches[:5]:  # 最多显示5行
                line_no = lm.get("LineNumber", 0)
                content = lm.get("Line", "").strip()[:200]
                lines.append(f"   📌 L{line_no}: {content}")
            if len(line_matches) > 5:
                lines.append(f"   ... 还有 {len(line_matches) - 5} 处匹配")

    return "\n".join(lines)


def interactive_search():
    """交互式搜索模式"""
    print("🔍 Briar Search 交互模式")
    print("输入查询语句，或输入 'quit' 退出\n")

    domains_config = load_domains()
    if domains_config.get("domains"):
        print("可用业务域:", ", ".join(domains_config["domains"].keys()))
        print()

    while True:
        try:
            query = input("查询> ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\n再见!")
            break

        if not query or query.lower() in ("quit", "exit", "q"):
            break

        # 解析特殊前缀
        domain = ""
        actual_query = query

        if query.startswith("d:") or query.startswith("domain:"):
            parts = query.split(" ", 1)
            if len(parts) == 2:
                domain = parts[0].split(":", 1)[1]
                actual_query = parts[1]

        final_query = build_zoekt_query(
            actual_query, domain=domain, domains_config=domains_config
        )
        print(f"[解析后查询: {final_query}]")

        results = search_via_api(final_query)
        if "error" in results:
            results_text = search_via_cli(final_query)
            print(results_text)
        else:
            print(format_results(results, verbose=True))

        print()


def main():
    global ZOEKT_HOST

    import argparse

    parser = argparse.ArgumentParser(description="Briar Search 查询工具")
    parser.add_argument("query", nargs="?", help="搜索查询语句")
    parser.add_argument("-d", "--domain", help="业务域筛选")
    parser.add_argument("-r", "--repo", help="仓库名筛选")
    parser.add_argument("-l", "--language", help="编程语言筛选")
    parser.add_argument("-f", "--file", help="文件路径筛选")
    parser.add_argument("-n", "--num", type=int, default=20, help="结果数量")
    parser.add_argument("--json", action="store_true", help="JSON 输出")
    parser.add_argument("--raw", action="store_true", help="原始输出")
    parser.add_argument("--interactive", "-i", action="store_true", help="交互模式")
    parser.add_argument("--host", default=ZOEKT_HOST, help="Zoekt 服务地址")

    args = parser.parse_args()
    ZOEKT_HOST = args.host

    if args.interactive or not args.query:
        interactive_search()
        return

    domains_config = load_domains()
    final_query = build_zoekt_query(
        args.query,
        domain=args.domain,
        repo_filter=args.repo,
        language=args.language,
        file_pattern=args.file,
        domains_config=domains_config,
    )

    print(f"[查询: {final_query}]")

    results = search_via_api(final_query, args.num)
    if "error" in results:
        output = search_via_cli(final_query, args.num)
        print(output)
    elif args.raw:
        print(json.dumps(results, ensure_ascii=False, indent=2))
    elif args.json:
        print(json.dumps(results, ensure_ascii=False, indent=2))
    else:
        print(format_results(results, verbose=True))


if __name__ == "__main__":
    main()
