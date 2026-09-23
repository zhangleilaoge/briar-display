#!/usr/bin/env python3
"""Export Xiaohongshu cookies from local Chrome into xiaohongshu-mcp cookies.json."""
from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

try:
    import browser_cookie3
except ImportError as e:
    raise SystemExit("pip3 install --user browser-cookie3 后再跑") from e

DOMAINS = ("xiaohongshu.com", "xhscdn.com")


def load_chrome():
    # May trigger macOS Keychain prompt — user must Allow.
    return browser_cookie3.chrome(domain_name=".xiaohongshu.com")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--out",
        default=str(Path.home() / "tools/xiaohongshu-mcp/cookies.json"),
    )
    args = ap.parse_args()
    out = Path(args.out).expanduser()
    out.parent.mkdir(parents=True, exist_ok=True)

    jar = load_chrome()
    cookies = []
    for c in jar:
        host = (c.domain or "").lstrip(".")
        if not any(host.endswith(d) for d in DOMAINS):
            continue
        cookies.append(
            {
                "name": c.name,
                "value": c.value,
                "domain": c.domain if c.domain.startswith(".") else f".{c.domain}",
                "path": c.path or "/",
                "expires": int(c.expires) if c.expires else -1,
                "httpOnly": bool(getattr(c, "_rest", {}).get("HttpOnly", False))
                if False
                else False,
                "secure": bool(c.secure),
                "sameSite": "None",
            }
        )

    # Prefer richer domain pass if first pass thin
    if len(cookies) < 3:
        jar2 = browser_cookie3.chrome()
        seen = {(x["name"], x["domain"]) for x in cookies}
        for c in jar2:
            dom = c.domain or ""
            if "xiaohongshu" not in dom and "xhs" not in dom:
                continue
            key = (c.name, dom if dom.startswith(".") else f".{dom}")
            if key in seen:
                continue
            cookies.append(
                {
                    "name": c.name,
                    "value": c.value,
                    "domain": key[1],
                    "path": c.path or "/",
                    "expires": int(c.expires) if c.expires else -1,
                    "httpOnly": False,
                    "secure": bool(c.secure),
                    "sameSite": "None",
                }
            )
            seen.add(key)

    names = {c["name"] for c in cookies}
    if "web_session" not in names:
        raise SystemExit(
            f"导出了 {len(cookies)} 条 cookie，但没有 web_session。"
            "请确认 Chrome 已登录小红书，并在钥匙串弹窗点「允许」。"
        )

    seed = 1143445271
    if out.exists():
        try:
            old = json.loads(out.read_text())
            seed = int(old.get("seed") or seed)
            bak = out.with_suffix(out.suffix + ".bak")
            bak.write_text(out.read_text())
        except Exception:
            pass

    payload = {
        "version": 2,
        "seed": seed,
        "saved_at": int(time.time()),
        "cookies": cookies,
    }
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2))
    print(f"wrote {out} cookies={len(cookies)} has_web_session=yes")


if __name__ == "__main__":
    main()
