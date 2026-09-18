#!/usr/bin/env python3
"""Harvest grok.com sso / sso-rw via WebBridge CDP and import into grok2api Admin.

Never prints full cookie values. Writes 0600 files under ~/.config/briar-skills/.
"""
from __future__ import annotations

import argparse
import json
import os
import ssl
import sys
import urllib.error
import urllib.request
from pathlib import Path

CONFIG_DIR = Path(os.environ.get("BRIAR_SKILLS_CONFIG", Path.home() / ".config" / "briar-skills"))
SSO_FILE = CONFIG_DIR / "grok-sso.env"
CDP = os.environ.get("BRIAR_WEBBRIDGE_CDP", "http://127.0.0.1:10086").rstrip("/")
G2A = os.environ.get("BRIAR_G2A_BASE", "http://127.0.0.1:8000").rstrip("/")


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


def http_json(url: str, method: str = "GET", body: dict | None = None, timeout: float = 15.0):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={"Content-Type": "application/json", "Accept": "application/json"},
    )
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
    except Exception as e:  # noqa: BLE001 — surface clear errors to agent
        die(f"HTTP {method} {url} failed: {e}")


def cdp_cookies() -> list[dict]:
    """Best-effort: WebBridge may expose /json/version + classic CDP HTTP endpoints.

    If the local bridge uses a different shape, fall back to reading SSO_FILE written
    by a human/agent using DevTools — still 0600, still no chat paste.
    """
    # Probe
    try:
        status, _ = http_json(f"{CDP}/json/version")
        info(f"CDP /json/version → HTTP {status}")
    except SystemExit:
        raise
    except Exception as e:  # pragma: no cover
        die(f"CDP not reachable at {CDP}: {e}")

    # Many bridges list targets at /json/list
    status, targets = http_json(f"{CDP}/json/list")
    if status != 200:
        # some use /json
        status, targets = http_json(f"{CDP}/json")
    if not isinstance(targets, list):
        die(f"unexpected CDP target list (HTTP {status}); write {SSO_FILE} manually with SSO= and SSO_RW=")

    # Cookie fetch via /json endpoint variants is bridge-specific.
    # Prefer an optional helper endpoint if present.
    status, payload = http_json(f"{CDP}/json/cookies")
    if status == 200 and isinstance(payload, dict) and "cookies" in payload:
        return list(payload["cookies"])
    if status == 200 and isinstance(payload, list):
        return payload

    die(
        "CDP reachable but cookie export endpoint unknown. "
        f"Create {SSO_FILE} (chmod 0600) with lines SSO=… and SSO_RW=… from WebBridge UI, "
        "then re-run with --from-file. Do NOT paste cookies into chat."
    )


def load_from_file(path: Path) -> tuple[str, str]:
    if not path.is_file():
        die(f"missing {path}")
    sso = sso_rw = ""
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        k, v = line.split("=", 1)
        k = k.strip().upper()
        v = v.strip().strip('"').strip("'")
        if k in ("SSO", "GROK_SSO"):
            sso = v
        elif k in ("SSO_RW", "SSO-RW", "GROK_SSO_RW"):
            sso_rw = v
    if not sso or not sso_rw:
        die(f"{path} must contain SSO= and SSO_RW= (non-empty)")
    return sso, sso_rw


def save_sso_file(sso: str, sso_rw: str) -> Path:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    SSO_FILE.write_text(f"SSO={sso}\nSSO_RW={sso_rw}\n", encoding="utf-8")
    os.chmod(SSO_FILE, 0o600)
    info(f"wrote {SSO_FILE} mode 0600 (values redacted: {redact(sso)}, {redact(sso_rw)})")
    return SSO_FILE


def pick_grok_cookies(cookies: list[dict]) -> tuple[str, str]:
    sso = sso_rw = ""
    for c in cookies:
        name = str(c.get("name") or "")
        domain = str(c.get("domain") or "")
        if "grok" not in domain and "x.ai" not in domain:
            # still allow if name matches exactly
            if name not in ("sso", "sso-rw"):
                continue
        val = str(c.get("value") or "")
        if name == "sso":
            sso = val
        elif name == "sso-rw":
            sso_rw = val
    if not sso or not sso_rw:
        die("CDP cookies missing sso and/or sso-rw for grok — login at https://grok.com first")
    return sso, sso_rw


def import_to_grok2api(sso: str, sso_rw: str) -> None:
    """Try a few Admin API shapes; print clear error if version differs."""
    candidates = [
        ("POST", f"{G2A}/api/admin/sso/import", {"sso": sso, "sso_rw": sso_rw}),
        ("POST", f"{G2A}/api/admin/accounts/import", {"cookies": {"sso": sso, "sso-rw": sso_rw}}),
        ("POST", f"{G2A}/admin/api/sso", {"sso": sso, "sso-rw": sso_rw}),
    ]
    last = None
    for method, url, body in candidates:
        status, payload = http_json(url, method=method, body=body)
        last = (status, url, payload)
        if 200 <= status < 300:
            info(f"SSO import OK via {url} (HTTP {status}) — mark account active in Admin UI if needed")
            info("Open Admin UI, create client key g2a_…, save to ~/.config/briar-skills/grok2api-client.key (0600)")
            return
        info(f"try {url} → HTTP {status} (will try next)")
    die(
        f"all Admin import endpoints failed; last={last}. "
        "Check grok2api is up on :8000 and consult its Admin docs for the current SSO import API. "
        "You can still paste into Admin UI from the 0600 file without putting cookies in chat."
    )


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--from-file", type=Path, help="read SSO/SSO_RW from 0600 env file")
    ap.add_argument("--cdp-only", action="store_true", help="only harvest to file, skip Admin import")
    ap.add_argument("--import-only", action="store_true", help="skip CDP; import from default or --from-file")
    args = ap.parse_args()

    if args.import_only or args.from_file:
        path = args.from_file or SSO_FILE
        sso, sso_rw = load_from_file(path)
        info(f"loaded from {path}: {redact(sso)}, {redact(sso_rw)}")
    else:
        cookies = cdp_cookies()
        sso, sso_rw = pick_grok_cookies(cookies)
        save_sso_file(sso, sso_rw)

    if args.cdp_only:
        info("cdp-only: done")
        return

    import_to_grok2api(sso, sso_rw)


if __name__ == "__main__":
    main()
