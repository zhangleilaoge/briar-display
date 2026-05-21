#!/bin/bash
# briar-fix.sh - 代码修复基础设施
# Usage:
#   ./briar-fix.sh setup   <repo_path> <branch> <worktree_name>
#   ./briar-fix.sh verify  <worktree_path>
#   ./briar-fix.sh diff    <worktree_path>
#   ./briar-fix.sh commit  <worktree_path> <message>
#   ./briar-fix.sh push    <worktree_path>
#   ./briar-fix.sh cleanup <repo_path> <worktree_path>

set -e

CMD="${1}"

show_usage() {
	echo "Usage:"
	echo "  $0 setup   <repo_path> <branch> <worktree_name>"
	echo "  $0 verify  <worktree_path>"
	echo "  $0 diff    <worktree_path>"
	echo "  $0 commit  <worktree_path> <message>"
	echo "  $0 push    <worktree_path>"
	echo "  $0 cleanup <repo_path> <worktree_path>"
}

if [ -z "$CMD" ] || [ "$CMD" = "-h" ] || [ "$CMD" = "--help" ]; then
	show_usage
	exit 0
fi

# --- setup: 创建 worktree ---
if [ "$CMD" = "setup" ]; then
	REPO_PATH="${2}"
	BRANCH="${3}"
	WT_NAME="${4}"

	if [ -z "$REPO_PATH" ] || [ -z "$BRANCH" ] || [ -z "$WT_NAME" ]; then
		show_usage
		exit 1
	fi

	if [ ! -d "$REPO_PATH/.git" ]; then
		echo "Error: $REPO_PATH is not a git repository."
		exit 1
	fi

	# worktree 放在仓库同级目录
	REPO_NAME=$(basename "$REPO_PATH")
	WT_PATH="$(cd "$REPO_PATH/.." && pwd)/${REPO_NAME}-${WT_NAME}"

	cd "$REPO_PATH"

	# 检查 worktree 是否已存在
	if [ -d "$WT_PATH" ]; then
		echo "Worktree already exists at $WT_PATH"
		cd "$WT_PATH"
		# 如果有未提交改动，先 stash
		if ! git diff --quiet HEAD 2>/dev/null || ! git diff --cached --quiet HEAD 2>/dev/null; then
			echo "Stashing existing changes..."
			git stash push -m "briar-fix auto-stash $(date +%s)"
		fi
		git checkout "$BRANCH" 2>/dev/null || git checkout -b "$BRANCH" origin/"$BRANCH" 2>/dev/null || true
		echo "$WT_PATH"
		exit 0
	fi

	# 确保远程分支已获取
	git fetch origin "$BRANCH" 2>/dev/null || true

	# 创建 worktree
	git worktree add "$WT_PATH" "$BRANCH" 2>/dev/null || git worktree add -b "$BRANCH" "$WT_PATH" origin/"$BRANCH"

	echo "Worktree created: $WT_PATH"
	echo "$WT_PATH"

# --- verify: 运行项目验证 ---
elif [ "$CMD" = "verify" ]; then
	WT_PATH="${2}"

	if [ -z "$WT_PATH" ] || [ ! -d "$WT_PATH" ]; then
		echo "Error: worktree path is required."
		exit 1
	fi

	cd "$WT_PATH"
	echo "=== Running verification ==="

	# 按优先级尝试不同的验证命令
	if [ -f "package.json" ]; then
		if grep -q '"typecheck"' package.json 2>/dev/null && npm run typecheck >/dev/null 2>&1; then
			npm run typecheck
			exit 0
		elif grep -q '"lint"' package.json 2>/dev/null && npm run lint >/dev/null 2>&1; then
			npm run lint
			exit 0
		elif command -v npx >/dev/null 2>&1 && npx tsc --noEmit >/dev/null 2>&1; then
			npx tsc --noEmit
			exit 0
		fi
	fi

	if [ -f "Makefile" ]; then
		if make -n lint >/dev/null 2>&1; then
			make lint
			exit 0
		elif make -n test >/dev/null 2>&1; then
			make test
			exit 0
		fi
	fi

	if [ -f "biome.json" ] && command -v npx >/dev/null 2>&1; then
		npx biome check . 2>/dev/null && exit 0 || true
	fi

	echo "Warning: Could not auto-detect verification command. Please run manually."
	exit 0

# --- diff: 展示当前修改 ---
elif [ "$CMD" = "diff" ]; then
	WT_PATH="${2}"

	if [ -z "$WT_PATH" ] || [ ! -d "$WT_PATH" ]; then
		echo "Error: worktree path is required."
		exit 1
	fi

	cd "$WT_PATH"
	echo "=== Modified files ==="
	git status --short

	echo ""
	echo "=== Diff ==="
	git diff

# --- commit: 提交修改 ---
elif [ "$CMD" = "commit" ]; then
	WT_PATH="${2}"
	MESSAGE="${3}"

	if [ -z "$WT_PATH" ] || [ -z "$MESSAGE" ]; then
		echo "Error: worktree path and commit message are required."
		exit 1
	fi

	cd "$WT_PATH"
	git add -A
	git commit -m "$MESSAGE"
	echo "Committed: $(git rev-parse --short HEAD)"

# --- push: push 到远程 ---
elif [ "$CMD" = "push" ]; then
	WT_PATH="${2}"

	if [ -z "$WT_PATH" ]; then
		echo "Error: worktree path is required."
		exit 1
	fi

	cd "$WT_PATH"
	BRANCH=$(git rev-parse --abbrev-ref HEAD)
	git push origin "$BRANCH"
	echo "Pushed $BRANCH to origin"

# --- cleanup: 清理 worktree ---
elif [ "$CMD" = "cleanup" ]; then
	REPO_PATH="${2}"
	WT_PATH="${3}"

	if [ -z "$REPO_PATH" ] || [ -z "$WT_PATH" ]; then
		show_usage
		exit 1
	fi

	cd "$REPO_PATH"

	# 先检查是否有未提交改动
	if [ -d "$WT_PATH" ]; then
		cd "$WT_PATH"
		if ! git diff --quiet HEAD 2>/dev/null || ! git diff --cached --quiet HEAD 2>/dev/null; then
			echo "Warning: $WT_PATH has uncommitted changes. Stashing before cleanup..."
			git stash push -m "briar-fix auto-stash $(date +%s)"
		fi
		cd "$REPO_PATH"
	fi

	# 使用 git worktree remove 清理（安全，会检查）
	git worktree remove "$WT_PATH" 2>/dev/null || true

	# 如果目录还在（可能 remove 失败），强制清理
	if [ -d "$WT_PATH" ]; then
		rm -rf "$WT_PATH"
		git worktree prune
	fi

	echo "Worktree cleaned up: $WT_PATH"

else
	echo "Unknown command: $CMD"
	show_usage
	exit 1
fi
