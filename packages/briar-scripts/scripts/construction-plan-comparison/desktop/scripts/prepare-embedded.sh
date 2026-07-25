#!/usr/bin/env bash
set -e

# 准备内嵌运行环境：Bun 二进制 + 工具资源
# 用法：./scripts/prepare-embedded.sh [platform]
# platform: aarch64-apple-darwin | x86_64-apple-darwin | x86_64-pc-windows-msvc

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
TOOL_DIR="$(cd "${DESKTOP_DIR}/.." && pwd)"

# 默认当前平台
HOST_TRIPLE="aarch64-apple-darwin"
case "$(uname -sm)" in
	"Darwin arm64"|"Darwin ARM64") HOST_TRIPLE="aarch64-apple-darwin" ;;
	"Darwin x86_64"|"Darwin X86_64") HOST_TRIPLE="x86_64-apple-darwin" ;;
	"Linux x86_64") HOST_TRIPLE="x86_64-unknown-linux-gnu" ;;
	MINGW*|CYGWIN*|MSYS*) HOST_TRIPLE="x86_64-pc-windows-msvc" ;;
esac

TARGET="${1:-${HOST_TRIPLE}}"

echo "=============================================="
echo "准备内嵌运行环境"
echo "目标平台: ${TARGET}"
echo "=============================================="

mkdir -p "${DESKTOP_DIR}/src-tauri/binaries"
mkdir -p "${DESKTOP_DIR}/src-tauri/resources"

# 1. 复制工具资源到 resources/tool/
echo "复制工具资源..."
rm -rf "${DESKTOP_DIR}/src-tauri/resources/tool"
mkdir -p "${DESKTOP_DIR}/src-tauri/resources/tool"
cp -R "${TOOL_DIR}/src" "${DESKTOP_DIR}/src-tauri/resources/tool/src"
cp -R "${TOOL_DIR}/python_encoder" "${DESKTOP_DIR}/src-tauri/resources/tool/python_encoder"
cp "${TOOL_DIR}/package.json" "${DESKTOP_DIR}/src-tauri/resources/tool/package.json"

# 清理不需要的文件
rm -f "${DESKTOP_DIR}/src-tauri/resources/tool/python_encoder/.DS_Store"
find "${DESKTOP_DIR}/src-tauri/resources/tool" -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
find "${DESKTOP_DIR}/src-tauri/resources/tool" -name "*.pyc" -delete 2>/dev/null || true

echo "工具资源大小: $(du -sh ${DESKTOP_DIR}/src-tauri/resources/tool | cut -f1)"

# 2. 准备 Bun 二进制
echo "准备 Bun 二进制..."
BUN_BIN="$(command -v bun || true)"
if [ -z "${BUN_BIN}" ]; then
	echo "错误：未找到 bun，请先安装 Bun"
	exit 1
fi

BUN_FILE="${DESKTOP_DIR}/src-tauri/binaries/bun-${TARGET}"

case "${TARGET}" in
	aarch64-apple-darwin)
		cp "${BUN_BIN}" "${BUN_FILE}"
		chmod +x "${BUN_FILE}"
		;;
	x86_64-apple-darwin)
		# 如果当前是 Intel Mac，直接复制；否则尝试下载
		if [ "${HOST_TRIPLE}" = "x86_64-apple-darwin" ]; then
			cp "${BUN_BIN}" "${BUN_FILE}"
			chmod +x "${BUN_FILE}"
		else
			echo "提示：当前是 Apple Silicon，构建 Intel 版需要下载 Intel Bun 二进制"
			echo "  请手动下载并放到: ${BUN_FILE}"
			echo "  下载地址: https://github.com/oven-sh/bun/releases"
			exit 1
		fi
		;;
	x86_64-pc-windows-msvc)
		echo "提示：Windows 版 Bun 需要手动下载或到 Windows 环境构建"
		echo "  请放到: ${BUN_FILE}.exe"
		exit 1
		;;
	*)
		echo "不支持的目标平台: ${TARGET}"
		exit 1
		;;
esac

echo "Bun 二进制: ${BUN_FILE} ($(du -sh ${BUN_FILE} | cut -f1))"
echo ""
echo "=============================================="
echo "内嵌环境准备完成"
echo "=============================================="
