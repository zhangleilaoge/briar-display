#!/bin/bash
set -e

# briar-sync.sh — 反合主分支辅助脚本
# 用法: briar-sync.sh <command> [args]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

show_usage() {
  cat <<'EOF'
briar-sync.sh — 将最新主分支合入当前开发分支

用法:
  briar-sync.sh detect              环境检测 + 差距评估
  briar-sync.sh merge [main]        fetch + merge（main 默认自动检测）
  briar-sync.sh resolve <files...>  git add 已解决文件
  briar-sync.sh status              当前冲突状态
  briar-sync.sh verify              构建/lint/typecheck 验证
  briar-sync.sh abort               放弃本次 merge

选项:
  -h, --help    显示帮助
EOF
  exit 0
}

# --- 工具函数 ---

# 检测主分支名（master/main/其他）
detect_main_branch() {
  local main_branch
  # 优先从 remote HEAD 获取
  main_branch=$(git remote show origin 2>/dev/null | grep 'HEAD branch' | awk '{print $NF}')
  if [ -n "$main_branch" ] && [ "$main_branch" != "(unknown)" ]; then
    echo "$main_branch"
    return 0
  fi
  # 回退：检查常见名称
  for candidate in master main; do
    if git rev-parse --verify "origin/$candidate" >/dev/null 2>&1; then
      echo "$candidate"
      return 0
    fi
  done
  echo ""
  return 1
}

# 检查是否在 git 仓库中
ensure_git_repo() {
  if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "ERROR: 当前目录不是 git 仓库" >&2
    exit 1
  fi
}

# 检查工作区是否干净
check_clean_worktree() {
  if [ -n "$(git status --porcelain)" ]; then
    echo "DIRTY"
    return 1
  fi
  echo "CLEAN"
  return 0
}

# 检测项目构建命令
detect_build_cmd() {
  if [ -f "Makefile" ] && grep -q "^build:" Makefile 2>/dev/null; then
    echo "make build"
  elif [ -f "package.json" ]; then
    if command -v bun >/dev/null 2>&1 && [ -f "bun.lockb" ]; then
      echo "bun run build"
    elif [ -f "pnpm-lock.yaml" ]; then
      echo "pnpm run build"
    elif [ -f "yarn.lock" ]; then
      echo "yarn build"
    else
      echo "npm run build"
    fi
  else
    echo ""
  fi
}

# 检测 lint 命令
detect_lint_cmd() {
  if [ -f "package.json" ]; then
    if grep -q '"lint"' package.json 2>/dev/null; then
      if command -v bun >/dev/null 2>&1 && [ -f "bun.lockb" ]; then
        echo "bun run lint"
      elif [ -f "pnpm-lock.yaml" ]; then
        echo "pnpm run lint"
      elif [ -f "yarn.lock" ]; then
        echo "yarn lint"
      else
        echo "npm run lint"
      fi
    fi
  elif [ -f "Makefile" ] && grep -q "^lint:" Makefile 2>/dev/null; then
    echo "make lint"
  fi
}

# 检测 typecheck 命令
detect_typecheck_cmd() {
  if [ -f "package.json" ] && grep -q '"typecheck"' package.json 2>/dev/null; then
    if command -v bun >/dev/null 2>&1 && [ -f "bun.lockb" ]; then
      echo "bun run typecheck"
    elif [ -f "pnpm-lock.yaml" ]; then
      echo "pnpm run typecheck"
    elif [ -f "yarn.lock" ]; then
      echo "yarn typecheck"
    else
      echo "npm run typecheck"
    fi
  elif [ -f "tsconfig.json" ]; then
    echo "npx tsc --noEmit"
  fi
}

# 检测 lock 文件重新生成命令
detect_install_cmd() {
  if command -v bun >/dev/null 2>&1 && [ -f "bun.lockb" ]; then
    echo "bun install"
  elif [ -f "pnpm-lock.yaml" ]; then
    echo "pnpm install"
  elif [ -f "yarn.lock" ]; then
    echo "yarn install"
  elif [ -f "package-lock.json" ]; then
    echo "npm install"
  fi
}

# 判断文件是否为 lock 文件
is_lock_file() {
  case "$1" in
    yarn.lock|bun.lockb|package-lock.json|pnpm-lock.yaml) return 0 ;;
    *) return 1 ;;
  esac
}

# --- 命令实现 ---

cmd_detect() {
  ensure_git_repo

  local current_branch
  current_branch=$(git branch --show-current)
  if [ -z "$current_branch" ]; then
    echo "ERROR: 处于 detached HEAD 状态，无法确定当前分支" >&2
    exit 1
  fi

  local main_branch
  main_branch=$(detect_main_branch)
  if [ -z "$main_branch" ]; then
    echo "ERROR: 无法检测主分支，请手动指定: briar-sync.sh merge <main-branch>" >&2
    exit 1
  fi

  if [ "$current_branch" = "$main_branch" ]; then
    echo "INFO: 当前已在主分支 $main_branch 上，无需反合"
    exit 0
  fi

  local worktree_status
  worktree_status=$(check_clean_worktree) || true

  echo "=== briar-sync 环境检测 ==="
  echo "当前分支: $current_branch"
  echo "主分支:   $main_branch"
  echo "工作区:   $worktree_status"

  if [ "$worktree_status" = "DIRTY" ]; then
    echo ""
    echo "⚠️  工作区有未提交变更:"
    git status --short
    echo ""
    echo "请先 commit 或 stash 后再执行 merge"
    exit 1
  fi

  # fetch 最新
  echo ""
  echo "正在 fetch origin/$main_branch ..."
  git fetch origin "$main_branch" --quiet

  # 计算差距
  local behind_count
  behind_count=$(git rev-list --count "HEAD..origin/$main_branch" 2>/dev/null || echo "0")

  if [ "$behind_count" -eq 0 ]; then
    echo ""
    echo "✅ 当前分支已是最新，落后 0 个 commit"
    exit 0
  fi

  local file_count
  file_count=$(git diff --name-only "HEAD...origin/$main_branch" 2>/dev/null | wc -l | tr -d ' ')

  echo ""
  echo "📊 差距评估:"
  echo "   落后 commit 数: $behind_count"
  echo "   涉及文件数:     $file_count"
  echo ""
  echo "变更文件概览（前 20 个）:"
  git diff --stat "HEAD...origin/$main_branch" 2>/dev/null | tail -n 21 | head -n 20

  # 检查是否有潜在冲突
  echo ""
  echo "=== 潜在冲突预检 ==="
  # 找出双方都修改的文件
  local both_modified
  both_modified=$(comm -12 \
    <(git diff --name-only "HEAD...origin/$main_branch" 2>/dev/null | sort) \
    <(git diff --name-only "origin/$main_branch...HEAD" 2>/dev/null | sort) \
    2>/dev/null || true)

  if [ -z "$both_modified" ]; then
    echo "无双方同时修改的文件，预期无冲突"
  else
    local conflict_candidate_count
    conflict_candidate_count=$(echo "$both_modified" | wc -l | tr -d ' ')
    echo "双方同时修改的文件（$conflict_candidate_count 个，可能产生冲突）:"
    echo "$both_modified" | head -20
    if [ "$conflict_candidate_count" -gt 20 ]; then
      echo "   ... 还有 $((conflict_candidate_count - 20)) 个文件"
    fi
  fi
}

cmd_merge() {
  ensure_git_repo

  local current_branch
  current_branch=$(git branch --show-current)
  if [ -z "$current_branch" ]; then
    echo "ERROR: 处于 detached HEAD 状态" >&2
    exit 1
  fi

  local main_branch="${1:-}"
  if [ -z "$main_branch" ]; then
    main_branch=$(detect_main_branch)
    if [ -z "$main_branch" ]; then
      echo "ERROR: 无法检测主分支，请手动指定: briar-sync.sh merge <main-branch>" >&2
      exit 1
    fi
  fi

  if [ "$current_branch" = "$main_branch" ]; then
    echo "INFO: 当前已在主分支 $main_branch 上，无需反合"
    exit 0
  fi

  # 检查工作区
  local worktree_status
  worktree_status=$(check_clean_worktree) || true
  if [ "$worktree_status" = "DIRTY" ]; then
    echo "ERROR: 工作区有未提交变更，请先 commit 或 stash" >&2
    git status --short >&2
    exit 1
  fi

  echo "正在 fetch origin/$main_branch ..."
  git fetch origin "$main_branch" --quiet

  local behind_count
  behind_count=$(git rev-list --count "HEAD..origin/$main_branch" 2>/dev/null || echo "0")
  if [ "$behind_count" -eq 0 ]; then
    echo "✅ 已是最新，无需合并"
    exit 0
  fi

  echo "正在合并 origin/$main_branch → $current_branch （$behind_count 个 commit）..."
  echo ""

  if git merge "origin/$main_branch" --no-edit 2>&1; then
    echo ""
    echo "✅ 合并成功，无冲突"
    echo "MERGE_RESULT=CLEAN"
  else
    echo ""
    echo "⚠️  合并产生冲突，需要处理"
    echo "MERGE_RESULT=CONFLICT"
    echo ""
    echo "冲突文件:"
    git diff --name-only --diff-filter=U
    echo ""
    echo "分类:"
    # 分类冲突文件
    local lock_files=""
    local code_files=""
    while IFS= read -r f; do
      if is_lock_file "$f"; then
        lock_files="$lock_files $f"
      else
        code_files="$code_files $f"
      fi
    done < <(git diff --name-only --diff-filter=U)

    if [ -n "$lock_files" ]; then
      echo "  🔒 Lock 文件（可自动处理）:$lock_files"
    fi
    if [ -n "$code_files" ]; then
      echo "  📝 代码文件（需检查）:$code_files"
    fi
  fi
}

cmd_resolve() {
  ensure_git_repo

  if [ $# -eq 0 ]; then
    echo "ERROR: 请指定要标记为已解决的文件" >&2
    echo "用法: briar-sync.sh resolve <file1> [file2] ..." >&2
    exit 1
  fi

  for f in "$@"; do
    if [ ! -f "$f" ]; then
      echo "WARNING: 文件不存在: $f" >&2
      continue
    fi
    # 检查是否仍有冲突标记
    if grep -l "^<<<<<<< " "$f" >/dev/null 2>&1; then
      echo "ERROR: $f 仍包含冲突标记（<<<<<<<），请先解决冲突" >&2
      exit 1
    fi
    git add "$f"
    echo "✅ 已标记解决: $f"
  done

  echo ""
  cmd_status
}

cmd_status() {
  ensure_git_repo

  # 检查是否在 merge 状态
  if [ ! -f "$(git rev-parse --git-dir)/MERGE_HEAD" ]; then
    echo "当前无进行中的 merge"
    return 0
  fi

  local remaining
  remaining=$(git diff --name-only --diff-filter=U 2>/dev/null || true)

  if [ -z "$remaining" ]; then
    echo "✅ 所有冲突已解决，可以 commit"
    echo ""
    echo "暂存区状态:"
    git status --short
  else
    local count
    count=$(echo "$remaining" | wc -l | tr -d ' ')
    echo "⚠️  剩余 $count 个冲突文件待解决:"
    echo "$remaining"
  fi
}

cmd_verify() {
  ensure_git_repo

  echo "=== 验证 ==="
  local failed=0

  # 构建
  local build_cmd
  build_cmd=$(detect_build_cmd)
  if [ -n "$build_cmd" ]; then
    echo ""
    echo "🔨 构建: $build_cmd"
    if eval "$build_cmd" 2>&1 | tail -20; then
      echo "✅ 构建通过"
    else
      echo "❌ 构建失败"
      failed=1
    fi
  else
    echo "⏭️  未检测到构建命令，跳过"
  fi

  # Lint
  local lint_cmd
  lint_cmd=$(detect_lint_cmd)
  if [ -n "$lint_cmd" ]; then
    echo ""
    echo "🔍 Lint: $lint_cmd"
    if eval "$lint_cmd" 2>&1 | tail -20; then
      echo "✅ Lint 通过"
    else
      echo "❌ Lint 失败"
      failed=1
    fi
  else
    echo "⏭️  未检测到 lint 命令，跳过"
  fi

  # Typecheck
  local typecheck_cmd
  typecheck_cmd=$(detect_typecheck_cmd)
  if [ -n "$typecheck_cmd" ]; then
    echo ""
    echo "📐 类型检查: $typecheck_cmd"
    if eval "$typecheck_cmd" 2>&1 | tail -20; then
      echo "✅ 类型检查通过"
    else
      echo "❌ 类型检查失败"
      failed=1
    fi
  else
    echo "⏭️  未检测到 typecheck 命令，跳过"
  fi

  echo ""
  if [ "$failed" -eq 0 ]; then
    echo "✅ 全部验证通过"
    exit 0
  else
    echo "❌ 验证未通过，请修复后再 commit"
    exit 1
  fi
}

cmd_abort() {
  ensure_git_repo

  if [ ! -f "$(git rev-parse --git-dir)/MERGE_HEAD" ]; then
    echo "当前无进行中的 merge，无需 abort"
    exit 0
  fi

  git merge --abort
  echo "✅ 已放弃本次 merge，恢复到合并前状态"
}

# --- Lock 文件自动处理 ---

cmd_fix_lock() {
  ensure_git_repo

  local main_branch="${1:-}"
  if [ -z "$main_branch" ]; then
    main_branch=$(detect_main_branch)
  fi

  local install_cmd
  install_cmd=$(detect_install_cmd)
  if [ -z "$install_cmd" ]; then
    echo "未检测到包管理器，无法自动处理 lock 文件" >&2
    exit 1
  fi

  # 找出冲突的 lock 文件
  local lock_conflicts
  lock_conflicts=$(git diff --name-only --diff-filter=U 2>/dev/null | while IFS= read -r f; do
    is_lock_file "$f" && echo "$f"
  done || true)

  if [ -z "$lock_conflicts" ]; then
    echo "无冲突的 lock 文件"
    exit 0
  fi

  echo "处理 lock 文件冲突: $lock_conflicts"
  echo "策略: 取主分支版本 → 重新 $install_cmd 生成"

  for f in $lock_conflicts; do
    git checkout "origin/$main_branch" -- "$f" 2>/dev/null || git checkout --theirs -- "$f"
    echo "  已取主分支版本: $f"
  done

  echo ""
  echo "正在执行 $install_cmd 重新生成 ..."
  if eval "$install_cmd" 2>&1 | tail -5; then
    for f in $lock_conflicts; do
      git add "$f"
      echo "  ✅ 已解决: $f"
    done
  else
    echo "❌ $install_cmd 失败，请手动处理" >&2
    exit 1
  fi
}

# --- 入口 ---

case "${1:-}" in
  -h|--help)
    show_usage
    ;;
  detect)
    cmd_detect
    ;;
  merge)
    shift
    cmd_merge "$@"
    ;;
  resolve)
    shift
    cmd_resolve "$@"
    ;;
  status)
    cmd_status
    ;;
  verify)
    cmd_verify
    ;;
  abort)
    cmd_abort
    ;;
  fix-lock)
    shift
    cmd_fix_lock "$@"
    ;;
  "")
    show_usage
    ;;
  *)
    echo "ERROR: 未知命令: $1" >&2
    echo ""
    show_usage
    ;;
esac
