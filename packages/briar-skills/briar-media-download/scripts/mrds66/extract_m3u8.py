#!/usr/bin/env python3
"""Extract DPlayer data-config video.url (m3u8) from mrds66 HTML."""
import html as H
import json
import re
import sys

def main() -> int:
    path = sys.argv[1] if len(sys.argv) > 1 else "-"
    raw = sys.stdin.read() if path == "-" else open(path, encoding="utf-8", errors="ignore").read()
    m = re.search(r"data-config=([\"'])(.*?)\1", raw, re.S)
    if not m:
        m = re.search(r'data-config="([^"]+)"', raw)
    if not m:
        m = re.search(r"data-config='([^']+)'", raw)
    if not m:
        print("no DPlayer data-config on page", file=sys.stderr)
        return 1
    blob = m.group(2) if m.lastindex and m.lastindex >= 2 else m.group(1)
    cfg = json.loads(H.unescape(blob))
    url = None
    if isinstance(cfg.get("video"), dict):
        url = cfg["video"].get("url")
    url = url or cfg.get("url")
    if not url:
        print("data-config missing video.url", file=sys.stderr)
        return 1
    print(url)
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
