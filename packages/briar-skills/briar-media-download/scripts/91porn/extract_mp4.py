#!/usr/bin/env python3
"""Extract main mp4 URL from 91porn HTML via strencode2(...).

Page may also contain ccm.91p52.com <source> tags (ads / side channels).
Prefer the strencode2-decoded source as the primary video.
"""
from __future__ import annotations

import re
import sys
from urllib.parse import unquote


def extract(raw: str) -> str | None:
    # Prefer strencode2 payload (main video). Take first match.
    for m in re.finditer(r"strencode2\(\s*[\"']([^\"']+)[\"']\s*\)", raw):
        decoded = unquote(m.group(1))
        sm = re.search(r"src\s*=\s*['\"]([^'\"]+)['\"]", decoded, re.I)
        if sm and ".mp4" in sm.group(1).lower():
            return sm.group(1).strip()
        # sometimes the decoded blob is already a bare URL
        if decoded.strip().startswith("http") and ".mp4" in decoded.lower():
            return decoded.strip().split()[0].strip("'\"")
    return None


def main() -> int:
    path = sys.argv[1] if len(sys.argv) > 1 else "-"
    raw = sys.stdin.read() if path == "-" else open(path, encoding="utf-8", errors="ignore").read()
    url = extract(raw)
    if not url:
        print("no strencode2 mp4 source on page", file=sys.stderr)
        return 1
    print(url)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
