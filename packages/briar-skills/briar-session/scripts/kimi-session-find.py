#!/usr/bin/env python3
"""List kimi-code sessions active within a local time window.

Scans $HOME/.kimi-code/sessions/<wd_*>/session_*/state.json and reports
sessions whose [createdAt, lastActiveAt] interval overlaps the given window.
lastActiveAt = max(state.updatedAt, mtime of state.json / wire.jsonl).

Usage:
  kimi-session-find.py --from "2026-07-31 17:00" --to "2026-07-31 18:00"
  kimi-session-find.py --all [--keyword 导购]
"""

import argparse
import json
import os
import sys
from datetime import datetime

SESSIONS_ROOT = os.path.expanduser("~/.kimi-code/sessions")


def parse_local(s):
    s = s.strip().replace("T", " ")
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d"):
        try:
            return datetime.strptime(s, fmt).astimezone()
        except ValueError:
            continue
    raise SystemExit(f"无法解析时间: {s!r}，格式示例: '2026-07-31 17:00'")


def parse_iso(s):
    if not isinstance(s, str):
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        return None


def fmt(dt):
    return dt.astimezone().strftime("%m-%d %H:%M")


def collect():
    rows = []
    if not os.path.isdir(SESSIONS_ROOT):
        return rows
    for wd in sorted(os.listdir(SESSIONS_ROOT)):
        wd_dir = os.path.join(SESSIONS_ROOT, wd)
        if not os.path.isdir(wd_dir):
            continue
        for name in sorted(os.listdir(wd_dir)):
            if not name.startswith("session_"):
                continue
            sess_dir = os.path.join(wd_dir, name)
            state_path = os.path.join(sess_dir, "state.json")
            if not os.path.isfile(state_path):
                continue
            try:
                with open(state_path, encoding="utf-8") as f:
                    state = json.load(f)
            except (OSError, ValueError):
                continue
            created = parse_iso(state.get("createdAt"))
            candidates = [parse_iso(state.get("updatedAt"))]
            for rel in ("state.json", os.path.join("agents", "main", "wire.jsonl")):
                p = os.path.join(sess_dir, rel)
                if os.path.isfile(p):
                    candidates.append(
                        datetime.fromtimestamp(os.path.getmtime(p)).astimezone()
                    )
            candidates = [c for c in candidates if c]
            rows.append({
                "id": name[len("session_"):],
                "created": created or min(candidates, default=None),
                "active": max(candidates) if candidates else None,
                "title": state.get("title") or "",
                "work_dir": state.get("workDir") or "",
            })
    return rows


def main():
    ap = argparse.ArgumentParser(description="按时间窗口查找 kimi-code 历史会话")
    ap.add_argument("--from", dest="start", help="窗口起点，本地时间，如 '2026-07-31 17:00'")
    ap.add_argument("--to", dest="end", help="窗口终点，本地时间，如 '2026-07-31 18:00'")
    ap.add_argument("--keyword", help="按主题关键词过滤（不区分大小写）")
    ap.add_argument("--all", action="store_true", help="不限时间窗口，列出全部会话")
    args = ap.parse_args()

    if not args.all and not (args.start and args.end):
        ap.error("需要 --from 和 --to，或使用 --all")

    start = parse_local(args.start) if args.start else None
    end = parse_local(args.end) if args.end else None
    if start and end and start > end:
        start, end = end, start

    rows = collect()
    hits = []
    for r in rows:
        if start and end:
            if not r["created"] or not r["active"]:
                continue
            if r["created"] > end or r["active"] < start:
                continue
        if args.keyword and args.keyword.lower() not in r["title"].lower():
            continue
        hits.append(r)

    hits.sort(key=lambda r: r["active"] or r["created"] or datetime.min.astimezone(),
              reverse=True)

    if not hits:
        print("没有命中会话。可尝试扩大时间窗口或去掉关键词。", file=sys.stderr)
        sys.exit(1)

    print(f"共 {len(hits)} 个会话（时间均为本地时间）：\n")
    for r in hits:
        created = fmt(r["created"]) if r["created"] else "?"
        active = fmt(r["active"]) if r["active"] else "?"
        title = r["title"].replace("\n", " ")
        if len(title) > 60:
            title = title[:60] + "…"
        if title == "New Session":
            title += "  (无实质内容)"
        print(f"会话ID:  {r['id']}")
        print(f"  时间:  {created} → 最后活跃 {active}")
        print(f"  主题:  {title}")
        print(f"  目录:  {r['work_dir']}")
        print(f"  恢复:  cd {r['work_dir']} && kimi -S {r['id'][:8]}")
        print()


if __name__ == "__main__":
    main()
