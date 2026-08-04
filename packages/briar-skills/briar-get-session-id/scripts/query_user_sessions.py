#!/usr/bin/env python3
"""Query recent valid shopping-guide login sessions by kdtId or custom page key."""

import argparse
import fcntl
import json
import os
import re
import subprocess
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path


SHANGHAI = timezone(timedelta(hours=8))
MIN_REQUEST_INTERVAL_SECONDS = 0.35
LOG_LIMIT = 40
LOCK_PATH = Path("/tmp/briar-get-session-id.lock")
WHITELIST_URL = "https://columbus.prod.qima-inc.com/columbus/getWhiteList"
MAX_WINDOW_HOURS = 168  # 天网日志最多保留 7 天
SHOP_META_METHOD = (
    "com.youzan.shopcenter.shop.service.ShopMetaReadService.queryShopMetaInfo"
)
GUIDE_METHOD = (
    "com.youzan.guide.api.service.shoppingguide."
    "ShoppingGuideReadApiService.getShoppingGuide"
)


def now_text() -> str:
    return datetime.now(SHANGHAI).isoformat(timespec="seconds")


def progress(message: str) -> None:
    print(f"[{now_text()}] {message}", flush=True)


def mask(value: object, prefix: int = 3, suffix: int = 2) -> str:
    text = str(value or "")
    if len(text) <= prefix + suffix:
        return "*" * len(text)
    return f"{text[:prefix]}***{text[-suffix:]}"


def safe_output_dir(raw_path: str) -> Path:
    path = Path(raw_path).expanduser().resolve()
    home = Path.home().resolve()
    unsafe = {
        Path("/"),
        home,
        Path("/bin"),
        Path("/etc"),
        Path("/usr"),
        Path("/var"),
        Path("/System"),
    }
    if path in unsafe:
        raise ValueError(f"不安全的输出目录: {path}")
    path.mkdir(parents=True, exist_ok=True)
    return path


def secure_touch(path: Path) -> None:
    fd = os.open(path, os.O_CREAT | os.O_WRONLY, 0o600)
    os.close(fd)
    os.chmod(path, 0o600)


def secure_write_json(path: Path, value: dict) -> None:
    temporary = path.with_suffix(path.suffix + ".tmp")
    fd = os.open(temporary, os.O_CREAT | os.O_TRUNC | os.O_WRONLY, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(temporary, path)
    os.chmod(path, 0o600)


def append_masked_record(path: Path, record: dict) -> None:
    safe_record = {
        "completedAt": record["completedAt"],
        "requestType": record["requestType"],
        "candidateIndex": record.get("candidateIndex"),
        "userIdMasked": mask(record.get("userId")),
        "attempt": record["attempt"],
        "status": record["status"],
        "exitCode": record.get("exitCode"),
        "dubboCode": record.get("dubboCode"),
        "elapsedMs": record["elapsedMs"],
        "errorType": record.get("errorType"),
    }
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(safe_record, ensure_ascii=False) + "\n")
        handle.flush()


class RateLimiter:
    def __init__(self, interval_seconds: float) -> None:
        self.interval_seconds = interval_seconds
        self.last_start: float | None = None

    def wait(self) -> None:
        if self.last_start is not None:
            remaining = self.interval_seconds - (time.monotonic() - self.last_start)
            if remaining > 0:
                time.sleep(remaining)
        self.last_start = time.monotonic()


def find_zan_log_skill(explicit_path: str | None) -> Path:
    candidates = []
    if explicit_path:
        candidates.append(Path(explicit_path).expanduser())
    skill_home = os.environ.get("ZAN_LOG_QUERY_SKILL_DIR")
    if skill_home:
        candidates.append(Path(skill_home).expanduser())
    candidates.append(Path.home() / ".codex/skills/zan-log-query")
    candidates.append(Path.home() / ".agents/skills/zan-log-query")
    candidates.append(
        Path.home() / "Documents/gitlab/zan-skills/skills/zan-log-query"
    )
    for candidate in candidates:
        if (candidate / "SKILL.md").is_file() and (
            candidate / "scripts/logs.py"
        ).is_file():
            return candidate.resolve()
    raise RuntimeError(
        "缺少必需 Skill: zan-log-query；请安装后重试，"
        "或设置 ZAN_LOG_QUERY_SKILL_DIR"
    )


def find_zan_dubbo_skill(explicit_path: str | None) -> Path:
    candidates = []
    if explicit_path:
        candidates.append(Path(explicit_path).expanduser())
    skill_home = os.environ.get("ZAN_DUBBO_INVOKE_SKILL_DIR")
    if skill_home:
        candidates.append(Path(skill_home).expanduser())
    candidates.extend(
        [
            Path.home() / ".codex/skills/zan-dubbo-invoke",
            Path.home() / ".agents/skills/zan-dubbo-invoke",
            Path.home() / ".claude/skills/zan-dubbo-invoke",
            Path.home() / ".kimi-code/user-skills/zan-dubbo-invoke",
            Path.home() / ".helm/registry/skills/zan-dubbo-invoke",
        ]
    )
    for candidate in candidates:
        if (candidate / "SKILL.md").is_file() and (
            candidate / "scripts/dubbo_query.py"
        ).is_file():
            return candidate.resolve()
    raise RuntimeError(
        "缺少必需 Skill: zan-dubbo-invoke；"
        "请先安装（如 `helm skill install zan-dubbo-invoke -g`），"
        "或设置 ZAN_DUBBO_INVOKE_SKILL_DIR"
    )


def run_skill_pre_execute(skill_dir: Path, skill_name: str) -> None:
    hook = skill_dir / "scripts/pre-execute.sh"
    if not hook.is_file():
        raise RuntimeError(f"{skill_name} 缺少 scripts/pre-execute.sh")
    completed = subprocess.run(
        ["bash", str(hook), skill_name],
        cwd=skill_dir,
        check=False,
        capture_output=True,
        text=True,
        timeout=30,
    )
    if completed.returncode != 0:
        raise RuntimeError(f"{skill_name} 前置检查失败")


def resolve_dubbo_python(explicit_path: str | None) -> str:
    python_executable = explicit_path or os.environ.get("ZAN_DUBBO_PYTHON")
    if not python_executable:
        python_executable = sys.executable
    completed = subprocess.run(
        [
            python_executable,
            "-c",
            "import requests, browser_cookie3",
        ],
        check=False,
        capture_output=True,
        text=True,
        timeout=10,
    )
    if completed.returncode != 0:
        raise RuntimeError(
            "zan-dubbo-invoke 的 Python 运行时缺少 requests 或 browser-cookie3；"
            "请按该 Skill 的依赖说明安装，或通过 --zan-dubbo-python 指定可用解释器"
        )
    return python_executable


def resolve_page_key_kdt_ids(page_key: str) -> list[str]:
    """Fetch the columbus whitelist with the local Chrome CAS session and
    extract kdtIds bound to entries like `<page_key>_<kdtId>`."""
    try:
        import browser_cookie3
        import requests
    except ImportError as exc:
        raise RuntimeError(
            "解析定制页面 key 需要 requests 和 browser_cookie3，"
            "请使用带依赖的解释器执行（推荐 uv run --with requests "
            "--with browser_cookie3 --with truststore）"
        ) from exc
    # 公司网络存在证书代理，非系统 Python（如 uv 管理的解释器）的 certifi
    # 不包含企业根证书；优先注入系统钥匙串信任源。
    try:
        import truststore

        truststore.inject_into_ssl()
    except ImportError:
        pass
    progress(f"白名单拉取开始 pageKey={page_key}")
    cookies = browser_cookie3.chrome(domain_name="qima-inc.com")
    try:
        response = requests.get(WHITELIST_URL, cookies=cookies, timeout=60)
    except requests.exceptions.SSLError as exc:
        raise RuntimeError(
            "白名单拉取遇到证书校验失败，请使用系统 Python 执行，"
            "或为解释器安装 truststore（uv run 追加 --with truststore）"
        ) from exc
    if response.status_code != 200:
        raise RuntimeError(
            "白名单拉取失败，请确认 Chrome 已登录 CAS（cas.qima-inc.com）后重试"
        )
    pattern = re.compile(re.escape(page_key) + r"_(\d+)")
    kdt_ids = sorted(
        {match.group(1) for match in pattern.finditer(response.text)}
        - {"0"},
        key=int,
    )
    progress(f"白名单拉取完成 matchedShops={len(kdt_ids)}")
    return kdt_ids


def query_logs(
    skill_dir: Path,
    kdt_id: str,
    start: datetime,
    end: datetime,
) -> dict:
    command = [
        sys.executable,
        str(skill_dir / "scripts/logs.py"),
        "--raw",
        "--app",
        "uic-session",
        "--levels",
        "INFO",
        "--keyword",
        f'{kdt_id} "sourceType":"H5"',
        "--env",
        "prod",
        "--bu",
        "main",
        "--start",
        start.isoformat(timespec="seconds"),
        "--end",
        end.isoformat(timespec="seconds"),
        "--limit",
        str(LOG_LIMIT),
        "--message-limit",
        "5000",
    ]
    progress(
        "天网查询开始 "
        f"start={start.isoformat(timespec='seconds')} "
        f"end={end.isoformat(timespec='seconds')}"
    )
    completed = subprocess.run(
        command,
        check=False,
        capture_output=True,
        text=True,
        timeout=60,
    )
    if completed.returncode != 0:
        raise RuntimeError("天网查询失败，请检查 OPS 登录态、网络和应用权限")
    try:
        result = json.loads(completed.stdout)
    except json.JSONDecodeError as exc:
        raise RuntimeError("天网查询返回无法解析") from exc
    if not result.get("success"):
        raise RuntimeError("天网查询未成功，请检查 OPS 登录态和查询参数")
    progress(
        f"天网查询完成 total={result.get('total', 0)} "
        f"returned={len(result.get('logs', []))} "
        f"truncated={bool(result.get('truncated'))}"
    )
    return result


def extract_candidates(logs: list[dict]) -> list[dict]:
    buyer_pattern = re.compile(r'"buyerId"\s*:\s*(\d+)')
    session_pattern = re.compile(r"uic:session:([A-Za-z0-9]+)")
    seen: set[str] = set()
    candidates: list[dict] = []
    for item in logs:
        message = item.get("message") or ""
        buyer_match = buyer_pattern.search(message)
        session_match = session_pattern.search(message)
        if not buyer_match or not session_match:
            continue
        user_id = buyer_match.group(1)
        if user_id == "0" or user_id in seen:
            continue
        seen.add(user_id)
        candidates.append(
            {
                "userId": user_id,
                "sessionId": session_match.group(1),
                "logTime": item.get("time"),
                "traceId": item.get("traceId"),
            }
        )
    return candidates


def parse_dubbo_stdout(stdout: str) -> dict:
    marker = "调用结果:"
    marker_index = stdout.rfind(marker)
    if marker_index < 0:
        raise ValueError("missing-result-marker")
    result_text = stdout[marker_index + len(marker) :]
    first_json = min(
        (index for index in (result_text.find("{"), result_text.find("[")) if index >= 0),
        default=-1,
    )
    if first_json < 0:
        raise ValueError("missing-json-result")
    value, _ = json.JSONDecoder().raw_decode(result_text[first_json:])
    if not isinstance(value, dict):
        raise ValueError("unexpected-result-type")
    return value


def classify_dubbo_error(output: str) -> str:
    normalized = output.lower()
    if any(
        keyword in normalized
        for keyword in ("登录", "cookie", "oauth", "认证", "401", "403", "html")
    ):
        return "authentication"
    if any(keyword in normalized for keyword in ("限流", "rate limit", "429")):
        return "rate-limit"
    if any(keyword in normalized for keyword in ("timeout", "超时")):
        return "timeout"
    return "dubbo-invocation"


def invoke_dubbo(
    *,
    skill_dir: Path,
    python_executable: str,
    method: str,
    method_args: list,
    limiter: RateLimiter,
    record_path: Path,
    request_type: str,
    candidate_index: int | None = None,
    user_id: str | None = None,
) -> tuple[dict | None, str | None]:
    max_attempts = 2
    for attempt in range(1, max_attempts + 1):
        limiter.wait()
        started = time.monotonic()
        exit_code = None
        dubbo_code = None
        error_type = None
        response_obj = None
        try:
            completed = subprocess.run(
                [
                    python_executable,
                    str(skill_dir / "scripts/dubbo_query.py"),
                    method,
                    "--env",
                    "prod",
                    "--args",
                    json.dumps(method_args, ensure_ascii=False, separators=(",", ":")),
                    "--timeout",
                    "15000",
                    "--retries",
                    "0",
                ],
                cwd=skill_dir,
                check=False,
                capture_output=True,
                text=True,
                timeout=45,
            )
            exit_code = completed.returncode
            combined_output = f"{completed.stdout}\n{completed.stderr}"
            if completed.returncode == 0:
                response_obj = parse_dubbo_stdout(completed.stdout)
                dubbo_code = response_obj.get("code")
                if dubbo_code not in (None, 0) and not response_obj.get("success"):
                    error_type = "dubbo-response"
                    response_obj = None
            else:
                error_type = classify_dubbo_error(combined_output)
        except subprocess.TimeoutExpired:
            error_type = "timeout"
        except (json.JSONDecodeError, ValueError):
            error_type = "invalid-dubbo-output"

        elapsed_ms = round((time.monotonic() - started) * 1000)
        status = "success" if response_obj is not None else "error"
        append_masked_record(
            record_path,
            {
                "completedAt": now_text(),
                "requestType": request_type,
                "candidateIndex": candidate_index,
                "userId": user_id,
                "attempt": attempt,
                "status": status,
                "exitCode": exit_code,
                "dubboCode": dubbo_code,
                "elapsedMs": elapsed_ms,
                "errorType": error_type,
            },
        )
        progress(
            f"{request_type}"
            + (f" [{candidate_index}] userId={mask(user_id)}" if user_id else "")
            + f" attempt={attempt} {status} {elapsed_ms}ms"
        )

        if response_obj is not None:
            return response_obj, None
        if error_type == "authentication":
            return None, error_type
        if attempt < max_attempts:
            time.sleep(1.0)
    return None, error_type


def query_shop(
    *,
    kdt_id: str,
    expected: int,
    log_skill_dir: Path,
    dubbo_skill_dir: Path,
    dubbo_python: str,
    start: datetime,
    end: datetime,
    limiter: RateLimiter,
    record_path: Path,
) -> dict:
    """Query one shop; returns a summary dict including found guides."""
    root_response, root_error = invoke_dubbo(
        skill_dir=dubbo_skill_dir,
        python_executable=dubbo_python,
        method=SHOP_META_METHOD,
        method_args=[int(kdt_id)],
        limiter=limiter,
        record_path=record_path,
        request_type="root-kdt-query",
    )
    if root_error == "authentication":
        raise RuntimeError(
            "Dubbo 鉴权失败，请先在 Chrome 登录 CAS/Funeng 并访问 "
            "https://ticket.qima-inc.com 完成 Ticket 平台登录，"
            "再按 zan-dubbo-invoke 指引重试"
        )
    root_kdt_id = int(kdt_id)
    if root_response:
        shop_meta = (root_response.get("data") or {}).get("shopMetaInfo") or {}
        root_kdt_id = int(shop_meta.get("rootKdtId") or kdt_id)

    log_result = query_logs(log_skill_dir, kdt_id, start, end)
    candidates = extract_candidates(log_result.get("logs", []))
    progress(
        f"候选提取完成 kdtId={kdt_id} unique={len(candidates)} "
        f"expectedValid={expected}"
    )

    valid_guides = []
    failures = 0
    checked_candidates = 0
    for index, candidate in enumerate(candidates, start=1):
        if len(valid_guides) >= expected:
            break
        checked_candidates += 1
        user_id = candidate["userId"]
        progress(
            f"导购校验准备 [{index}/{len(candidates)}] "
            f"userId={mask(user_id)}"
        )
        response, error = invoke_dubbo(
            skill_dir=dubbo_skill_dir,
            python_executable=dubbo_python,
            method=GUIDE_METHOD,
            method_args=[{"guideId": int(user_id), "kdtId": int(kdt_id)}],
            limiter=limiter,
            record_path=record_path,
            request_type="guide-query",
            candidate_index=index,
            user_id=user_id,
        )
        if response is None:
            failures += 1
            if error == "authentication":
                raise RuntimeError(
                    "Dubbo 鉴权失败，请先在 Chrome 登录 CAS/Funeng 并访问 "
                    "https://ticket.qima-inc.com 完成 Ticket 平台登录，"
                    "再按 zan-dubbo-invoke 指引重试"
                )
            continue
        guide = ((response.get("data") or {}).get("data")) or {}
        if not isinstance(guide, dict) or not guide:
            continue
        guide_user_id = guide.get("userId") or guide.get("guideId")
        if not guide_user_id:
            continue
        valid_guides.append(
            {
                "mobile": guide.get("mobile"),
                "userId": guide_user_id,
                "sessionId": candidate["sessionId"],
                "time": candidate["logTime"],
                "kdtId": int(kdt_id),
            }
        )
        progress(f"有效导购已找到 {len(valid_guides)}/{expected} kdtId={kdt_id}")

    return {
        "kdtId": int(kdt_id),
        "rootKdtId": root_kdt_id,
        "logQuery": {
            "total": log_result.get("total", 0),
            "returned": len(log_result.get("logs", [])),
            "truncated": bool(log_result.get("truncated")),
        },
        "candidateCount": len(candidates),
        "checkedCandidateCount": checked_candidates,
        "validGuideCount": len(valid_guides),
        "failedGuideRequests": failures,
        "guides": valid_guides,
    }


def execute(args: argparse.Namespace) -> tuple[Path, Path, dict]:
    if bool(args.kdt_id) == bool(args.page_key):
        raise ValueError("必须且只能提供 --kdt-id 或 --page-key 之一")
    if args.kdt_id and (not args.kdt_id.isdigit() or int(args.kdt_id) <= 0):
        raise ValueError("kdtId 必须为正整数")
    if args.expected_valid_count <= 0:
        raise ValueError("expected-valid-count 必须为正整数")
    if not 1 <= args.window_hours <= MAX_WINDOW_HOURS:
        raise ValueError(
            f"window-hours 必须在 1 到 {MAX_WINDOW_HOURS} 之间（天网最多保留 7 天）"
        )
    if args.max_shops <= 0:
        raise ValueError("max-shops 必须为正整数")

    output_dir = safe_output_dir(args.output_dir)
    log_skill_dir = find_zan_log_skill(args.zan_log_skill_dir)
    dubbo_skill_dir = find_zan_dubbo_skill(args.zan_dubbo_skill_dir)
    run_skill_pre_execute(log_skill_dir, "zan-log-query")
    run_skill_pre_execute(dubbo_skill_dir, "zan-dubbo-invoke")
    dubbo_python = resolve_dubbo_python(args.zan_dubbo_python)

    end = datetime.now(SHANGHAI)
    start = end - timedelta(hours=args.window_hours)
    limiter = RateLimiter(MIN_REQUEST_INTERVAL_SECONDS)

    if args.page_key:
        shop_ids = resolve_page_key_kdt_ids(args.page_key)
        if not shop_ids:
            raise RuntimeError(
                f"白名单中不存在 pageKey={args.page_key} 的店铺，请检查 key 拼写"
            )
    else:
        shop_ids = [args.kdt_id]

    stamp = datetime.now(SHANGHAI).strftime("%Y%m%d-%H%M%S")
    label = args.kdt_id or args.page_key
    record_path = output_dir / f"session-request-records-{label}-{stamp}.jsonl"
    result_path = output_dir / f"session-results-{label}-{stamp}.json"
    secure_touch(record_path)

    all_guides: list[dict] = []
    shop_summaries: list[dict] = []
    shops_tried = 0
    total_failures = 0
    for kdt_id in shop_ids:
        if args.page_key and shops_tried >= args.max_shops:
            progress(f"已达 max-shops={args.max_shops}，停止尝试更多店铺")
            break
        shops_tried += 1
        progress(f"店铺查询开始 [{shops_tried}] kdtId={kdt_id}")
        remaining = args.expected_valid_count - len(all_guides)
        summary = query_shop(
            kdt_id=kdt_id,
            expected=remaining,
            log_skill_dir=log_skill_dir,
            dubbo_skill_dir=dubbo_skill_dir,
            dubbo_python=dubbo_python,
            start=start,
            end=end,
            limiter=limiter,
            record_path=record_path,
        )
        all_guides.extend(summary.pop("guides"))
        total_failures += summary["failedGuideRequests"]
        shop_summaries.append(summary)
        progress(
            f"店铺查询完成 kdtId={kdt_id} "
            f"validGuides={summary['validGuideCount']} "
            f"totalValid={len(all_guides)}/{args.expected_valid_count}"
        )
        if len(all_guides) >= args.expected_valid_count:
            progress("已达到预期有效记录数，停止后续店铺查询")
            break

    output = {
        "kdtId": int(args.kdt_id) if args.kdt_id else None,
        "pageKey": args.page_key,
        "windowHours": args.window_hours,
        "timeRange": {
            "start": start.isoformat(timespec="seconds"),
            "end": end.isoformat(timespec="seconds"),
        },
        "matchedShopCount": len(shop_ids) if args.page_key else None,
        "shopsTried": shops_tried,
        "maxShops": args.max_shops if args.page_key else None,
        "expectedValidCount": args.expected_valid_count,
        "targetReached": len(all_guides) >= args.expected_valid_count,
        "validGuideCount": len(all_guides),
        "failedGuideRequests": total_failures,
        "truncated": any(s["logQuery"]["truncated"] for s in shop_summaries),
        "shops": shop_summaries,
        "guides": all_guides,
        "requestRecordFile": str(record_path),
    }
    secure_write_json(result_path, output)
    progress(
        f"流程完成 shopsTried={shops_tried} "
        f"validGuides={len(all_guides)} failures={total_failures}"
    )
    return result_path, record_path, output


def main() -> int:
    parser = argparse.ArgumentParser(
        description="按 kdtId 或定制页面 key 查询有效导购登录 sessionId"
    )
    parser.add_argument("--kdt-id")
    parser.add_argument("--page-key")
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--window-hours", type=int, default=24)
    parser.add_argument("--expected-valid-count", type=int, default=2)
    parser.add_argument("--max-shops", type=int, default=3)
    parser.add_argument("--zan-log-skill-dir")
    parser.add_argument("--zan-dubbo-skill-dir")
    parser.add_argument("--zan-dubbo-python")
    args = parser.parse_args()

    lock_handle = LOCK_PATH.open("w", encoding="utf-8")
    try:
        fcntl.flock(lock_handle, fcntl.LOCK_EX)
        result_path, record_path, output = execute(args)
    except (RuntimeError, ValueError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    finally:
        fcntl.flock(lock_handle, fcntl.LOCK_UN)
        lock_handle.close()

    print(
        json.dumps(
            {
                "result": str(result_path),
                "records": str(record_path),
                "shopsTried": output["shopsTried"],
                "expectedValidCount": output["expectedValidCount"],
                "targetReached": output["targetReached"],
                "validGuideCount": output["validGuideCount"],
                "failedGuideRequests": output["failedGuideRequests"],
                "truncated": output["truncated"],
            },
            ensure_ascii=False,
        ),
        flush=True,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
