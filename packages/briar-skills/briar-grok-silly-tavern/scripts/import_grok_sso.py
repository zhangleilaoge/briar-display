#!/usr/bin/env python3
"""Harvest grok.com sso / sso-rw and import into grok2api Admin.

Preferred path: Kimi WebBridge POST http://127.0.0.1:10086/command
  (find_tab + cdp Network.getCookies) — verified 2026-09-18.

Never prints full cookie values. Writes 0600 files under ~/.config/briar-skills/.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

CONFIG_DIR = Path(os.environ.get("BRIAR_SKILLS_CONFIG", Path.home() / ".config" / "briar-skills"))
SSO_FILE = CONFIG_DIR / "grok-sso.env"
WB = os.environ.get("BRIAR_WEBBRIDGE", "http://127.0.0.1:10086").rstrip("/")
G2A = os.environ.get("BRIAR_G2A_BASE", "http://127.0.0.1:8000").rstrip("/")
SESSION = os.environ.get("BRIAR_WB_SESSION", "briar-grok-sso-refresh")
G2A_HOME = Path(os.environ.get("Grok2API_HOME", Path.home() / "Documents/github/grok2api"))


def die(msg: str, code: int = 1) -> None:
    print(f"ERROR: {msg}", file=sys.stderr)
    raise SystemExit(code)


def info(msg: str) -> None:
    print(f"INFO: {msg}")


def redact(v: str) -> str:
    if not v:
        return "(empty)"
    if len(v) <= 8:
        return "***"
    return f"{v[:3]}…{v[-3:]} (len={len(v)})"


def http_json(url: str, method: str = "GET", body: dict | None = None, headers: dict | None = None, timeout: float = 30.0):
    data = None if body is None else json.dumps(body).encode()
    hdrs = {"Content-Type": "application/json", "Accept": "application/json"}
    if headers:
        hdrs.update(headers)
    req = urllib.request.Request(url, data=data, method=method, headers=hdrs)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            return resp.status, json.loads(raw) if raw.strip() else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(raw) if raw.strip() else {}
        except json.JSONDecodeError:
            parsed = {"raw": raw[:500]}
        return e.code, parsed
    except Exception as e:  # noqa: BLE001
        die(f"HTTP {method} {url} failed: {e}")


def wb_command(action: str, args: dict | None = None) -> dict:
    status, payload = http_json(
        f"{WB}/command",
        method="POST",
        body={"action": action, "args": args or {}, "session": SESSION},
    )
    if status != 200 or not payload.get("ok", True):
        # some builds nest under data without ok
        if status == 200 and "data" in payload:
            return payload
        die(f"WebBridge {action} failed HTTP {status}: {str(payload)[:300]}")
    return payload


def cookies_via_webbridge() -> list[dict]:
    # status (optional)
    try:
        st, _ = http_json(f"{WB}/status")
        info(f"WebBridge /status → HTTP {st}")
    except SystemExit:
        die(f"WebBridge not reachable at {WB} — run: ~/.kimi-webbridge/bin/kimi-webbridge start")

    # Open/reuse grok tab. Never require active:true (fails if another tab is focused).
    opened = False
    for action, args in (
        ("find_tab", {"url": "https://grok.com", "create": True}),
        ("find_tab", {"url": "https://grok.com", "open": True}),
        ("navigate", {"url": "https://grok.com"}),
    ):
        try:
            status, payload = http_json(
                f"{WB}/command",
                method="POST",
                body={"action": action, "args": args, "session": SESSION},
            )
            if status == 200 and isinstance(payload, dict) and payload.get("ok") is False:
                info(f"WebBridge {action} skip: {str(payload)[:180]}")
                continue
            if status == 200:
                info(f"WebBridge {action} ok")
                opened = True
                break
            info(f"WebBridge {action} HTTP {status}: {str(payload)[:180]}")
        except SystemExit as e:
            info(f"WebBridge {action} skip: {e}")
    if not opened:
        wb_command("navigate", {"url": "https://grok.com"})

    payload = wb_command(
        "cdp",
        {"method": "Network.getCookies", "params": {"urls": ["https://grok.com", "https://www.grok.com"]}},
    )
    data = payload.get("data") or payload.get("result") or payload
    cookies = data.get("cookies") if isinstance(data, dict) else None
    if cookies is None and isinstance(data, dict):
        cookies = (data.get("result") or {}).get("cookies")
    if not isinstance(cookies, list):
        die(f"unexpected CDP cookie payload keys={list(data)[:20] if isinstance(data, dict) else type(data)}")
    names = sorted({c.get("name") for c in cookies if isinstance(c, dict)})
    info(f"cookie names on grok.com: {names}")
    return cookies

def pick_grok_cookies(cookies: list[dict]) -> tuple[str, str]:
    sso = sso_rw = ""
    for c in cookies:
        if not isinstance(c, dict):
            continue
        name = str(c.get("name") or "")
        val = str(c.get("value") or "")
        if name == "sso":
            sso = val
        elif name in ("sso-rw", "sso_rw"):
            sso_rw = val
    if not sso or not sso_rw:
        die("missing sso and/or sso-rw — open https://grok.com in the WebBridge browser and login, then retry")
    return sso, sso_rw


def load_from_file(path: Path) -> tuple[str, str]:
    if not path.is_file():
        die(f"missing {path}")
    sso = sso_rw = ""
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        k, v = k.strip().upper(), v.strip().strip('"').strip("'")
        if k in ("SSO", "GROK_SSO"):
            sso = v
        elif k in ("SSO_RW", "SSO-RW", "GROK_SSO_RW"):
            sso_rw = v
    if not sso or not sso_rw:
        die(f"{path} must contain SSO= and SSO_RW=")
    return sso, sso_rw


def save_sso_file(sso: str, sso_rw: str) -> Path:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    SSO_FILE.write_text(f"SSO={sso}\nSSO_RW={sso_rw}\n", encoding="utf-8")
    os.chmod(SSO_FILE, 0o600)
    info(f"wrote {SSO_FILE} mode 0600 ({redact(sso)}, {redact(sso_rw)})")
    return SSO_FILE


def admin_creds() -> tuple[str, str]:
    user = os.environ.get("BRIAR_G2A_ADMIN_USER", "")
    pw = os.environ.get("BRIAR_G2A_ADMIN_PASS", "")
    cfg = G2A_HOME / "config.yaml"
    if cfg.is_file() and (not user or not pw):
        text = cfg.read_text(encoding="utf-8")
        # naive yaml scrape for bootstrapAdmin
        m_user = re.search(r"bootstrapAdmin:.*?username:\s*[\"']?([^\s\"']+)", text, re.S)
        m_pw = re.search(r"bootstrapAdmin:.*?password:\s*[\"']?([^\s\"']+)", text, re.S)
        if m_user and not user:
            user = m_user.group(1)
        if m_pw and not pw:
            pw = m_pw.group(1)
    if not user or not pw:
        die("set BRIAR_G2A_ADMIN_USER/PASS or keep bootstrapAdmin in grok2api config.yaml")
    return user, pw


def import_to_grok2api(sso: str, sso_rw: str) -> None:
    user, pw = admin_creds()
    status, login = http_json(
        f"{G2A}/api/admin/v1/auth/login",
        method="POST",
        body={"username": user, "password": pw},
    )
    if status != 200:
        die(f"admin login failed HTTP {status}")
    token = ((login.get("data") or {}).get("tokens") or {}).get("accessToken") or login.get("accessToken")
    if not token:
        die("admin login OK but no accessToken in response")
    # multipart import — write tiny cookie file without printing values
    import tempfile
    import mimetypes

    boundary = "----briarBoundary7MA4YWxkTrZu0gW"
    cookie_body = f"sso={sso}; sso-rw={sso_rw}\n".encode()
    parts = []
    parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"files\"; filename=\"sso.txt\"\r\nContent-Type: text/plain\r\n\r\n".encode())
    parts.append(cookie_body)
    parts.append(f"\r\n--{boundary}--\r\n".encode())
    body = b"".join(parts)
    req = urllib.request.Request(
        f"{G2A}/api/admin/v1/accounts/web/import",
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            info(f"web SSO import HTTP {resp.status} ({raw[:120].replace(sso,'').replace(sso_rw,'')})")
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")[:300]
        die(f"web SSO import failed HTTP {e.code}: {raw}")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--from-file", type=Path, help="read SSO/SSO_RW from 0600 env file")
    ap.add_argument("--via-webbridge", action="store_true", help="force Kimi WebBridge /command harvest")
    ap.add_argument("--cdp-only", action="store_true", help="only harvest to file, skip Admin import")
    ap.add_argument("--import-only", action="store_true", help="skip harvest; import from file")
    args = ap.parse_args()

    if args.import_only or (args.from_file and not args.via_webbridge):
        path = args.from_file or SSO_FILE
        sso, sso_rw = load_from_file(path)
        info(f"loaded from {path}: {redact(sso)}, {redact(sso_rw)}")
    else:
        cookies = cookies_via_webbridge()
        sso, sso_rw = pick_grok_cookies(cookies)
        save_sso_file(sso, sso_rw)

    if args.cdp_only:
        info("cdp-only: done")
        return

    import_to_grok2api(sso, sso_rw)
    info("done — if ST still fails, hard-refresh ST and confirm Proxy Password + model grok-chat-fast")


if __name__ == "__main__":
    main()
