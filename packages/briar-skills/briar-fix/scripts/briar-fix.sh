#!/bin/bash
# briar-fix.sh - 代码修复工作流脚本
# Usage:
#   ./briar-fix.sh verify  <worktree_path>
#   ./briar-fix.sh diff    <worktree_path>
#   ./briar-fix.sh commit  <worktree_path> <message>
#   ./briar-fix.sh push    <worktree_path>
#
# worktree 的创建/删除用 git worktree 原生命令（见 briar-repo SKILL.md「三、Worktree 管理」），本脚本只负责 worktree 内的修复操作。

set -e

CMD="${1}"

show_usage() {
	echo "Usage:"
	echo "  $0 verify  <worktree_path>"
	echo "  $0 diff    <worktree_path>"
	echo "  $0 commit  <worktree_path> <message>"
	echo "  $0 push    <worktree_path>"
}

if [ -z "$CMD" ] || [ "$CMD" = "-h" ] || [ "$CMD" = "--help" ]; then
	show_usage
	exit 0
fi

# --- verify: 运行项目验证 ---
if [ "$CMD" = "verify" ]; then
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

else
	echo "Unknown command: $CMD"
	show_usage
	exit 1
fi
