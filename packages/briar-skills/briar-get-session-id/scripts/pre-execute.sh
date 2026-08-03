#!/usr/bin/env bash

set -u

SKILL_NAME="${1:-}"
CALL_COUNT="${2:-1}"
MODE="${3:-all}"
ENDPOINT="${REPORT_USAGE_ENDPOINT:-https://zode.qa.qima-inc.com/api/skill/report-usage}"
CHECK_INTERVAL_SECONDS="${SKILL_RUNTIME_CHECK_INTERVAL_SECONDS:-300}"

if [ -z "${SKILL_NAME}" ]; then
  echo "Usage: bash scripts/pre-execute.sh <skill-name> [call-count] [all|sync-only|report-only]" >&2
  exit 1
fi

if ! [[ "${CALL_COUNT}" =~ ^[0-9]+$ ]]; then
  CALL_COUNT="1"
fi

if ! [[ "${CHECK_INTERVAL_SECONDS}" =~ ^[0-9]+$ ]]; then
  CHECK_INTERVAL_SECONDS="300"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SKILL_FILE="${SKILL_DIR}/SKILL.md"
HELM_DIR="${HOME}/.helm"
CACHE_DIR="${HELM_DIR}/skill-runtime-cache"
CACHE_FILE="${CACHE_DIR}/pre-execute.cache"
CACHE_PREFIX="${SKILL_NAME}."
REGISTRY_PULL_NAME="${SKILL_NAME}"
REGISTRY_SKILL_DIR="${HELM_DIR}/registry/skills/${SKILL_NAME}"
REGISTRY_PRE_EXECUTE_FILE="${REGISTRY_SKILL_DIR}/scripts/pre-execute.sh"
LOCAL_PRE_EXECUTE_FILE="${SKILL_DIR}/scripts/pre-execute.sh"
NESTED_REGISTRY_PULL_NAME=""
NESTED_REGISTRY_SKILL_DIR=""

set_registry_paths() {
  REGISTRY_PULL_NAME="$1"
  REGISTRY_SKILL_DIR="$2"
  REGISTRY_PRE_EXECUTE_FILE="${REGISTRY_SKILL_DIR}/scripts/pre-execute.sh"
}

derive_nested_registry_fallback() {
  local relative_path top_level nested_path

  case "${SKILL_DIR}" in
    */skills/*)
      relative_path="${SKILL_DIR##*/skills/}"
      ;;
    *)
      return 0
      ;;
  esac

  case "${relative_path}" in
    */*)
      ;;
    *)
      return 0
      ;;
  esac

  top_level="${relative_path%%/*}"
  nested_path="${relative_path#*/}"
  [ -n "${top_level}" ] || return 0
  [ "${top_level}" != "${SKILL_NAME}" ] || return 0

  NESTED_REGISTRY_PULL_NAME="${top_level}"
  NESTED_REGISTRY_SKILL_DIR="${HELM_DIR}/registry/skills/${top_level}/${nested_path}"
}

pull_registry_skill() {
  set_registry_paths "${SKILL_NAME}" "${HELM_DIR}/registry/skills/${SKILL_NAME}"
  if helm skill pull "${REGISTRY_PULL_NAME}" >/dev/null 2>&1 && [ -f "${REGISTRY_SKILL_DIR}/SKILL.md" ]; then
    return 0
  fi

  if [ -n "${NESTED_REGISTRY_PULL_NAME}" ]; then
    set_registry_paths "${NESTED_REGISTRY_PULL_NAME}" "${NESTED_REGISTRY_SKILL_DIR}"
    if helm skill pull "${REGISTRY_PULL_NAME}" >/dev/null 2>&1 && [ -f "${REGISTRY_SKILL_DIR}/SKILL.md" ]; then
      return 0
    fi
  fi

  return 1
}

derive_nested_registry_fallback

read_frontmatter_value() {
  local file="$1"
  local key="$2"

  [ -f "${file}" ] || return 1

  awk -v key="${key}" '
    NR == 1 && $0 == "---" { in_frontmatter = 1; next }
    in_frontmatter && $0 == "---" { exit }
    in_frontmatter && $0 ~ ("^" key ":[[:space:]]*") {
      sub("^[^:]+:[[:space:]]*", "", $0)
      gsub(/\r$/, "", $0)
      print $0
      exit
    }
  ' "${file}"
}

detect_call_source() {
  if [ -n "${CURSOR_TRACE_ID:-}" ] || [ -n "${CURSOR_AGENT:-}" ] || [ -n "${CURSOR_SESSION_ID:-}" ]; then
    echo "cursor"
    return
  fi

  if [ -n "${CLAUDECODE:-}" ] || [ -n "${CLAUDE_CODE_ENTRYPOINT:-}" ] || [ -n "${CLAUDE_SESSION_ID:-}" ]; then
    echo "claude-code"
    return
  fi

  if [ -n "${CODEX_HOME:-}" ] || [ -n "${CODEX_ENV:-}" ] || [ -n "${OPENAI_CODEX_ENV:-}" ]; then
    echo "codex"
    return
  fi

  echo "unknown"
}

extract_git_owner_from_remote() {
  local remote_url path owner
  remote_url="$(git remote get-url origin 2>/dev/null || true)"
  [ -z "${remote_url}" ] && return 1

  case "${remote_url}" in
    git@*:* )
      path="${remote_url#*:}"
      ;;
    http://*|https://* )
      path="${remote_url#*://}"
      path="${path#*/}"
      ;;
    * )
      path="${remote_url}"
      ;;
  esac

  path="${path%.git}"
  owner="${path%%/*}"
  [ -n "${owner}" ] || return 1
  echo "${owner}"
}

detect_git_username() {
  if [ -n "${REPORT_GIT_USERNAME:-}" ]; then
    echo "${REPORT_GIT_USERNAME}"
    return
  fi

  if [ -n "${GITLAB_USER_LOGIN:-}" ]; then
    echo "${GITLAB_USER_LOGIN}"
    return
  fi

  if [ -n "${GITLAB_USERNAME:-}" ]; then
    echo "${GITLAB_USERNAME}"
    return
  fi

  local email user owner
  email="$(git config --get user.email 2>/dev/null || true)"
  if [ -n "${email}" ]; then
    user="${email%@*}"
    if [ -n "${user}" ]; then
      echo "${user}"
      return
    fi
  fi

  user="$(git config --get user.name 2>/dev/null || true)"
  if [ -n "${user}" ]; then
    echo "${user}"
    return
  fi

  owner="$(extract_git_owner_from_remote 2>/dev/null || true)"
  if [ -n "${owner}" ]; then
    echo "${owner}"
    return
  fi

  echo "unknown"
}

load_cache() {
  LAST_CHECKED_EPOCH=""
  CACHED_LOCAL_UPDATED=""

  [ -f "${CACHE_FILE}" ] || return 0

  while IFS='=' read -r key value; do
    case "${key}" in
      "${CACHE_PREFIX}last_checked_epoch")
        LAST_CHECKED_EPOCH="${value}"
        ;;
      "${CACHE_PREFIX}local_updated")
        CACHED_LOCAL_UPDATED="${value}"
        ;;
    esac
  done < "${CACHE_FILE}"
}

save_cache() {
  local tmp_file
  mkdir -p "${CACHE_DIR}"
  tmp_file="${CACHE_FILE}.tmp.$$"

  if [ -f "${CACHE_FILE}" ]; then
    awk -v prefix="${CACHE_PREFIX}" 'index($0, prefix) != 1 { print }' "${CACHE_FILE}" > "${tmp_file}"
  else
    : > "${tmp_file}"
  fi

  cat >> "${tmp_file}" <<EOF
${CACHE_PREFIX}last_checked_epoch=${LAST_CHECKED_EPOCH}
${CACHE_PREFIX}local_updated=${CURRENT_LOCAL_UPDATED}
EOF

  mv "${tmp_file}" "${CACHE_FILE}"
}

is_managed_local_install() {
  case "${SKILL_DIR}" in
    "${HOME}/.claude/skills/"*|"${HOME}/.cursor/skills/"*|"${HOME}/.agent/skills/"*)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

sync_local_pre_execute_from_registry() {
  is_managed_local_install || return 0
  [ -f "${REGISTRY_PRE_EXECUTE_FILE}" ] || return 0
  [ -f "${LOCAL_PRE_EXECUTE_FILE}" ] || return 0

  if ! cmp -s "${REGISTRY_PRE_EXECUTE_FILE}" "${LOCAL_PRE_EXECUTE_FILE}"; then
    cp "${REGISTRY_PRE_EXECUTE_FILE}" "${LOCAL_PRE_EXECUTE_FILE}"
    chmod +x "${LOCAL_PRE_EXECUTE_FILE}" 2>/dev/null || true
    echo "[pre-execute] synced script: skill=${SKILL_NAME}"
  fi
}

sync_skill() {
  local now_epoch local_updated_before remote_updated should_check_remote

  local_updated_before="$(read_frontmatter_value "${SKILL_FILE}" updated 2>/dev/null || true)"
  CURRENT_LOCAL_UPDATED="${local_updated_before}"
  load_cache
  sync_local_pre_execute_from_registry

  now_epoch="$(date +%s)"
  should_check_remote="1"

  if [[ "${LAST_CHECKED_EPOCH:-}" =~ ^[0-9]+$ ]] && [ "${CACHED_LOCAL_UPDATED:-}" = "${local_updated_before}" ]; then
    if [ $((now_epoch - LAST_CHECKED_EPOCH)) -lt "${CHECK_INTERVAL_SECONDS}" ]; then
      should_check_remote="0"
    fi
  fi

  if [ "${should_check_remote}" = "0" ]; then
    echo "[pre-execute] cache-hit: skip sync check for ${SKILL_NAME}"
    return 0
  fi

  if pull_registry_skill; then
    sync_local_pre_execute_from_registry

    remote_updated="$(read_frontmatter_value "${REGISTRY_SKILL_DIR}/SKILL.md" updated 2>/dev/null || true)"

    if [ -n "${local_updated_before}" ] && [ -n "${remote_updated}" ] && [ "${local_updated_before}" != "${remote_updated}" ]; then
      cp -r "${REGISTRY_SKILL_DIR}/." "${SKILL_DIR}/"
      CURRENT_LOCAL_UPDATED="${remote_updated}"
      echo "[pre-execute] update applied: skill=${SKILL_NAME}, old=${local_updated_before}, new=${remote_updated}"

      if ! is_managed_local_install; then
        echo "[pre-execute] note: this project-local skill has been automatically updated."
      fi
    else
      CURRENT_LOCAL_UPDATED="${local_updated_before}"
      echo "[pre-execute] checked: skill=${SKILL_NAME}, updated=${local_updated_before:-unknown} (up to date)"
    fi
  else
    echo "[pre-execute] warning: failed to pull skill=${SKILL_NAME}" >&2
    CURRENT_LOCAL_UPDATED="${local_updated_before}"
  fi

  LAST_CHECKED_EPOCH="${now_epoch}"
  save_cache
}

report_usage() {
  local call_source git_username called_at payload

  call_source="$(detect_call_source)"
  git_username="$(detect_git_username)"
  called_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

  read -r -d '' payload <<EOF || true
{
  "callSource": "${call_source}",
  "gitUsername": "${git_username}",
  "events": [
    {
      "skillName": "${SKILL_NAME}",
      "callCount": ${CALL_COUNT},
      "calledAt": "${called_at}"
    }
  ]
}
EOF

  if curl --silent --show-error --fail \
    --location "${ENDPOINT}" \
    --header 'Content-Type: application/json' \
    --data "${payload}" >/dev/null; then
    echo "[pre-execute] reported: skill=${SKILL_NAME}, source=${call_source}, gitUsername=${git_username}"
    return 0
  fi

  echo "[pre-execute] warning: failed to report usage to ${ENDPOINT}" >&2
  return 0
}

case "${MODE}" in
  all)
    sync_skill
    report_usage
    ;;
  sync-only)
    sync_skill
    ;;
  report-only)
    report_usage
    ;;
  *)
    echo "Usage: bash scripts/pre-execute.sh <skill-name> [call-count] [all|sync-only|report-only]" >&2
    exit 1
    ;;
esac
