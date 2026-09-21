#!/usr/bin/env python3
"""
用 Playwright + Chrome cookie 无头抓取内网页面。

优先级：
1. 从 Chrome 读取 .qima-inc.com cookie
2. 用无头 Chromium 访问页面
3. 如果仍被重定向到登录页，尝试用 JIRA 账号密码登录（仅 Jira）
4. 失败则退出，由调用方 fallback 到 AppleScript

依赖：playwright, browser-cookie3
"""

import argparse
import os
import sys
from pathlib import Path
from urllib.parse import urlparse


def load_env():
    """加载 briar 标准 .env 配置。"""
    global_env = Path.home() / ".config" / "briar-skills" / ".env"
    if global_env.exists():
        # shellcheck source=/dev/null
        with open(global_env, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, val = line.split("=", 1)
                val = val.strip().strip('"').strip("'")
                if key and key not in os.environ:
                    os.environ[key] = val

    project_env = os.environ.get("BRIAR_PROJECT_ENV")
    if not project_env:
        try:
            import subprocess
            project_env = subprocess.run(
                ["git", "rev-parse", "--show-toplevel"],
                capture_output=True, text=True, check=False
            ).stdout.strip()
            if project_env:
                project_env = f"{project_env}/.env"
        except Exception:
            project_env = ""
    if project_env and Path(project_env).exists():
        with open(project_env, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, val = line.split("=", 1)
                val = val.strip().strip('"').strip("'")
                if key and key not in os.environ:
                    os.environ[key] = val


def get_chrome_cookies(domain: str = ".qima-inc.com"):
    try:
        import browser_cookie3
    except ImportError:
        print("[fetch_with_playwright] browser_cookie3 not installed", file=sys.stderr)
        return []

    try:
        cj = browser_cookie3.chrome(domain_name=domain)
    except Exception as e:
        print(f"[fetch_with_playwright] Failed to read Chrome cookies: {e}", file=sys.stderr)
        return []

    cookies = []
    for c in cj:
        http_only = getattr(c, "rest", {})
        if isinstance(http_only, dict):
            http_only = http_only.get("HttpOnly", False)
        else:
            http_only = False
        cookies.append({
            "name": c.name,
            "value": c.value,
            "domain": c.domain,
            "path": c.path,
            "httpOnly": bool(http_only),
            "secure": bool(c.secure),
            "sameSite": "Lax",
        })
    return cookies


def is_login_page(page, url: str) -> bool:
    """判断当前页面是否是登录页。"""
    current_url = page.url
    title = page.title().lower()
    if "login" in current_url.lower() or "登录" in title or "sign in" in title:
        return True
    if "jira" in url.lower() and ("欢迎访问 jira" in page.content().lower() or "you must log in" in page.content().lower()):
        return True
    return False


def jira_login(page, username: str, password: str):
    """在 Jira 登录页填写账号密码。"""
    page.fill("input#login-form-username, input[name='os_username']", username)
    page.fill("input#login-form-password, input[name='os_password']", password)
    page.click("input#login-form-submit, input[type='submit']")
    page.wait_for_load_state("networkidle", timeout=15000)


def extract_main_content(page, url: str) -> str:
    """智能提取页面主内容。"""
    selectors = [
        '[data-testid*="issue-body"]',
        '#issue-content',
        '.issue-view',
        '[role="main"]',
        'main',
        '.content',
        'article',
        'body',
    ]
    for sel in selectors:
        loc = page.locator(sel).first
        if loc.count() > 0:
            text = loc.inner_text(timeout=10000)
            if text and len(text.strip()) > 50:
                return text.strip()
    return page.inner_text('body').strip()


def fetch(url: str, use_password_fallback: bool = True) -> str:
    from playwright.sync_api import sync_playwright

    cookies = get_chrome_cookies(".qima-inc.com")
    if not cookies:
        print("[fetch_with_playwright] No Chrome cookies found", file=sys.stderr)
        sys.exit(2)

    print(f"[fetch_with_playwright] Loaded {len(cookies)} cookies from Chrome", file=sys.stderr)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        context.add_cookies(cookies)
        page = context.new_page()

        try:
            page.goto(url, wait_until="networkidle", timeout=30000)
        except Exception as e:
            print(f"[fetch_with_playwright] Page load error: {e}", file=sys.stderr)
            browser.close()
            sys.exit(3)

        # 如果仍被重定向到登录页，尝试账号密码登录（仅 Jira）
        if is_login_page(page, url):
            parsed = urlparse(url)
            is_jira = "jira" in parsed.netloc.lower()
            if is_jira and use_password_fallback:
                username = os.environ.get("JIRA_USERNAME") or os.environ.get("JIRA_USER")
                password = os.environ.get("JIRA_PASSWORD") or os.environ.get("JIRA_PASS")
                if username and password:
                    print("[fetch_with_playwright] Cookie login failed, trying password fallback", file=sys.stderr)
                    try:
                        jira_login(page, username, password)
                    except Exception as e:
                        print(f"[fetch_with_playwright] Jira password login failed: {e}", file=sys.stderr)
                        browser.close()
                        sys.exit(4)

                    if is_login_page(page, url):
                        print("[fetch_with_playwright] Still on login page after password attempt", file=sys.stderr)
                        browser.close()
                        sys.exit(4)
                else:
                    print("[fetch_with_playwright] No JIRA credentials for fallback", file=sys.stderr)
                    browser.close()
                    sys.exit(4)
            else:
                print("[fetch_with_playwright] Still on login page, no fallback available", file=sys.stderr)
                browser.close()
                sys.exit(4)

        title = page.title()
        body = extract_main_content(page, url)
        browser.close()

        return f"TITLE:{title}\n---BODY---\n{body}"


def main():
    parser = argparse.ArgumentParser(description="Fetch intranet page with Playwright + Chrome cookies")
    parser.add_argument("url", help="Target URL")
    parser.add_argument("--no-password-fallback", action="store_true", help="Disable password fallback")
    args = parser.parse_args()

    load_env()

    try:
        result = fetch(args.url, use_password_fallback=not args.no_password_fallback)
        print(result)
    except Exception as e:
        print(f"[fetch_with_playwright] Unexpected error: {e}", file=sys.stderr)
        sys.exit(5)


if __name__ == "__main__":
    main()
