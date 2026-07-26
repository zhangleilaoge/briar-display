#!/usr/bin/env bash
set -e

# 上传 Tauri 桌面端产物到 GitHub Release
# 用法：./scripts/upload-release.sh [target]
# target: current | mac-intel | mac-silicon | windows

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${DESKTOP_DIR}"

TARGET="${1:-current}"

# 读取版本号
VERSION="$(node -p "require('./package.json').version")"
TAG="desktop-v${VERSION}"

# 检查 gh
if ! command -v gh >/dev/null 2>&1; then
	echo "错误：未找到 gh (GitHub CLI)，请先安装并登录:"
	echo "  macOS: brew install gh && gh auth login"
	echo "  Windows: winget install --id GitHub.cli && gh auth login"
	exit 1
fi

# 检查登录状态
if ! gh auth status >/dev/null 2>&1; then
	echo "错误：gh 未登录，请先运行: gh auth login"
	exit 1
fi

# 收集要上传的文件
FILES=()
case "${TARGET}" in
	current|mac-intel|mac-silicon)
		for f in "${DESKTOP_DIR}/src-tauri/target/release/bundle/dmg"/施工方案比对_*.dmg; do
			[ -e "${f}" ] && FILES+=("${f}")
		done
		;;
	windows)
		for f in "${DESKTOP_DIR}/src-tauri/target/x86_64-pc-windows-msvc/release/bundle/msi"/施工方案比对_*.msi; do
			[ -e "${f}" ] && FILES+=("${f}")
		done
		for f in "${DESKTOP_DIR}/src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis"/施工方案比对_*.exe; do
			[ -e "${f}" ] && FILES+=("${f}")
		done
		;;
	*)
		echo "用法: $0 [current|mac-intel|mac-silicon|windows]"
		exit 1
		;;
esac

if [ ${#FILES[@]} -eq 0 ]; then
	echo "错误：没有找到可上传的产物，请先成功打包"
	exit 1
fi

echo ""
echo "=============================================="
echo "上传产物到 GitHub Release"
echo "版本: ${VERSION}"
echo "标签: ${TAG}"
echo "平台: ${TARGET}"
echo "产物:"
printf '  %s\n' "${FILES[@]}"
echo "=============================================="

# 确保 tag 存在（使用当前 HEAD）
if ! git rev-parse "${TAG}" >/dev/null 2>&1; then
	echo "创建标签: ${TAG}"
	git tag -a "${TAG}" -m "Desktop release ${VERSION}"
	git push origin "${TAG}"
else
	echo "标签已存在: ${TAG}"
fi

# 确保 release 存在
if ! gh release view "${TAG}" >/dev/null 2>&1; then
	echo "创建 GitHub Release: ${TAG}"
	gh release create "${TAG}" \
		--title "Desktop ${VERSION}" \
		--notes "施工方案比对桌面端 ${VERSION}" \
		|| {
			echo "创建 release 失败，可能已存在或网络问题"
			exit 1
		}
else
	echo "GitHub Release 已存在: ${TAG}"
fi

# 上传产物
gh release upload "${TAG}" "${FILES[@]}" --clobber

echo ""
echo "=============================================="
echo "上传完成"
echo "Release 地址: https://github.com/$(gh repo view --json owner,name -q '.owner.login + "/" + .name')/releases/tag/${TAG}"
echo "=============================================="
