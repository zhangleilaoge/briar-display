#!/usr/bin/env bash
set -e

# 上传打包产物到 GitHub Release
# 用法：./scripts/upload-release.sh <target> <version>
#   target: windows | mac-intel | mac-silicon | current
#   version: 1.0.0

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${DESKTOP_DIR}"

TARGET="${1:-current}"
VERSION="${2:-$(node -p "require('./package.json').version")}"
TAG="v${VERSION}"
TITLE="施工方案比对 ${VERSION}"

if ! command -v gh >/dev/null 2>&1; then
	echo "错误：未找到 GitHub CLI (gh)"
	echo "请先安装：https://cli.github.com/"
	echo "Windows 可用: winget install --id GitHub.cli"
	exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
	echo "错误：gh 未登录"
	echo "请先运行: gh auth login"
	exit 1
fi

ASSETS=()
case "${TARGET}" in
	windows)
		WIN_BUNDLE="${DESKTOP_DIR}/src-tauri/target/x86_64-pc-windows-msvc/release/bundle"
		for f in "${WIN_BUNDLE}"/msi/*.msi; do
			[ -f "$f" ] && ASSETS+=("$f")
		done
		for f in "${WIN_BUNDLE}"/nsis/*.exe; do
			[ -f "$f" ] && ASSETS+=("$f")
		done
		;;
	mac-intel|mac-silicon|current)
		MAC_BUNDLE="${DESKTOP_DIR}/src-tauri/target/release/bundle"
		for f in "${MAC_BUNDLE}"/dmg/*.dmg; do
			[ -f "$f" ] && ASSETS+=("$f")
		done
		;;
esac

if [ ${#ASSETS[@]} -eq 0 ]; then
	echo "错误：未找到可上传的产物"
	exit 1
fi

echo ""
echo "准备上传 ${#ASSETS[@]} 个产物到 GitHub Release ${TAG}"
for f in "${ASSETS[@]}"; do
	echo "  - $(basename "$f")"
done

if gh release view "${TAG}" >/dev/null 2>&1; then
	echo "Release ${TAG} 已存在，执行上传..."
	gh release upload "${TAG}" "${ASSETS[@]}" --clobber
else
	echo "创建 Release ${TAG}..."
	gh release create "${TAG}" --title "${TITLE}" --generate-notes "${ASSETS[@]}"
fi

echo "上传完成: https://github.com/$(gh repo view --json owner,name -q '.owner.login + "/" + .name')/releases/tag/${TAG}"
