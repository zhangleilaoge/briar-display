#!/bin/bash
# briar-repo.sh - 仓库本地维护工具
# Usage:
#   ./briar-repo.sh update        <repo-name> [base_dir]
#   ./briar-repo.sh clean         <repo-name> [base_dir]
#   ./briar-repo.sh base-dir      [domain]
#
# 注意：
# - 拉取/定位仓库请使用 zan-gitlab skill。
# - worktree 管理：直接使用 git worktree 原生命令（见 SKILL.md「三、Worktree 管理」）。

set -e

# --- 统一加载 .env 配置 ---
load_env() {
	# 1. 全局配置
	local global_env="$HOME/.config/briar-skills/.env"
	if [ -f "$global_env" ]; then
		# shellcheck source=/dev/null
		set -a; source "$global_env"; set +a
	fi

	# 2. 项目内 .env：优先 BRIAR_PROJECT_ENV，否则尝试当前 git 仓库根目录
	local project_env=""
	if [ -n "$BRIAR_PROJECT_ENV" ]; then
		project_env="$BRIAR_PROJECT_ENV"
	else
		project_env=$(git rev-parse --show-toplevel 2>/dev/null || true)
		if [ -n "$project_env" ]; then
			project_env="$project_env/.env"
		fi
	fi
	if [ -n "$project_env" ] && [ -f "$project_env" ]; then
		# shellcheck source=/dev/null
		set -a; source "$project_env"; set +a
	fi
}
load_env

ACTION="${1}"

show_usage() {
	echo "Usage:"
	echo "  $0 update   <repo-name> [base_dir]"
	echo "  $0 clean    <repo-name> [base_dir]"
	echo "  $0 base-dir [domain]"
	echo ""
	echo "Examples:"
	echo "  $0 update retail-app-member"
	echo "  $0 clean retail-app-member"
	echo ""
	echo "Notes:"
	echo "  - 拉取/定位仓库请使用 zan-gitlab skill。"
	echo "  - worktree 管理：直接使用 git worktree 原生命令（见 SKILL.md「三、Worktree 管理」）。"
	echo "  - 默认 base_dir: $HOME/projects"
}

if [ -z "$ACTION" ] || [ "$ACTION" = "-h" ] || [ "$ACTION" = "--help" ]; then
	show_usage
	exit 0
fi

REPO_NAME="${2}"
BASE_DIR="${3:-${BRIAR_REPO_BASE_DIR:-$HOME/projects}}"
LOCAL_PATH="${BASE_DIR}/${REPO_NAME}"

# --- base-dir: 输出默认本地父目录 ---
if [ "$ACTION" = "base-dir" ]; then
	DOMAIN="${2:-gitlab.qima-inc.com}"
	case "$DOMAIN" in
		gitlab.qima-inc.com | gitlab.com)
			echo "$HOME/Documents/gitlab"
			;;
		github.com)
			echo "$HOME/Documents/github"
			;;
		*)
			echo "$HOME/projects"
			;;
	esac
	exit 0
fi

if [ -z "$REPO_NAME" ]; then
	show_usage
	exit 1
fi

# --- update: stash + fetch --all + pull 所有本地分支 ---
if [ "$ACTION" = "update" ]; then
	if [ ! -d "$LOCAL_PATH/.git" ]; then
		echo "Error: $LOCAL_PATH is not a git repository."
		echo "请先用 zan-gitlab skill 拉取仓库。"
		exit 1
	fi

	cd "$LOCAL_PATH"

	CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

	# 1. stash
	if ! git diff --quiet HEAD 2>/dev/null || ! git diff --cached --quiet HEAD 2>/dev/null; then
		echo "📦 Stashing changes..."
		git stash push -m "briar-repo auto-stash $(date +%s)"
	else
		echo "📦 No local changes to stash."
	fi

	# 2. fetch all
	echo "📦 Fetching all remotes..."
	git fetch --all

	# 3. pull 每个有 upstream 的本地分支
	echo "📦 Pulling tracked branches..."
	for branch in $(git branch --format='%(refname:short)'); do
		upstream=$(git rev-parse --abbrev-ref "$branch@{upstream}" 2>/dev/null || true)
		if [ -n "$upstream" ]; then
			git checkout "$branch" >/dev/null 2>&1
			if git pull origin "$branch" >/dev/null 2>&1; then
				echo "  ✅ $branch"
			else
				echo "  ⚠️  $branch (skipped or diverged)"
			fi
		fi
	done

	# 回到原来的分支
	git checkout "$CURRENT_BRANCH" >/dev/null 2>&1 || true
	echo ""
	echo "✅ Update complete: $LOCAL_PATH"
	exit 0
fi

# --- clean: 删除所有 worktree + update ---
if [ "$ACTION" = "clean" ]; then
	if [ ! -d "$LOCAL_PATH/.git" ]; then
		echo "Error: $LOCAL_PATH is not a git repository."
		echo "请先用 zan-gitlab skill 拉取仓库。"
		exit 1
	fi

	cd "$LOCAL_PATH"

	# 1. 删除所有 worktree
	WT_COUNT=$(git worktree list --porcelain | grep -c '^worktree ' || true)
	if [ "$WT_COUNT" -gt 1 ] 2>/dev/null; then
		echo "📦 Removing all worktrees..."
		for wt in $(git worktree list --porcelain | grep '^worktree ' | tail -n +2 | cut -d' ' -f2-); do
			if [ -d "$wt" ]; then
				cd "$wt"
				if ! git diff --quiet HEAD 2>/dev/null || ! git diff --cached --quiet HEAD 2>/dev/null; then
					echo "  Stashing changes in $wt..."
					git stash push -m "briar-repo auto-stash $(date +%s)"
				fi
				cd "$LOCAL_PATH"
				git worktree remove "$wt" 2>/dev/null || true
				if [ -d "$wt" ]; then
					rm -rf "$wt"
				fi
			fi
		done
		git worktree prune
		echo "  ✅ All worktrees removed."
	else
		echo "📦 No worktrees to remove."
	fi

	# 2. update
	cd "$LOCAL_PATH"
	CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

	if ! git diff --quiet HEAD 2>/dev/null || ! git diff --cached --quiet HEAD 2>/dev/null; then
		echo "📦 Stashing changes..."
		git stash push -m "briar-repo auto-stash $(date +%s)"
	fi

	echo "📦 Fetching all remotes..."
	git fetch --all

	echo "📦 Pulling tracked branches..."
	for branch in $(git branch --format='%(refname:short)'); do
		upstream=$(git rev-parse --abbrev-ref "$branch@{upstream}" 2>/dev/null || true)
		if [ -n "$upstream" ]; then
			git checkout "$branch" >/dev/null 2>&1
			if git pull origin "$branch" >/dev/null 2>&1; then
				echo "  ✅ $branch"
			else
				echo "  ⚠️  $branch (skipped or diverged)"
			fi
		fi
	done

	git checkout "$CURRENT_BRANCH" >/dev/null 2>&1 || true
	echo ""
	echo "✅ Clean complete: $LOCAL_PATH"
	exit 0
fi

echo "Unknown action: $ACTION"
show_usage
exit 1
