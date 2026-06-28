#!/usr/bin/env bash
set -e

# 施工方案比对工具环境一键安装脚本
# 创建 Python 虚拟环境并安装依赖

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="${SCRIPT_DIR}/python_encoder/.venv"
REQUIREMENTS="${SCRIPT_DIR}/python_encoder/requirements.txt"

echo "=============================================="
echo "BidDocComparator 环境准备"
echo "=============================================="

# 检查 Python3
if ! command -v python3 &> /dev/null; then
    echo "错误：未找到 python3，请先安装 Python 3.10+"
    exit 1
fi

PY_VERSION=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
echo "Python 版本: ${PY_VERSION}"

# 创建虚拟环境
if [ -d "${VENV_DIR}" ]; then
    echo "虚拟环境已存在: ${VENV_DIR}"
else
    echo "创建虚拟环境..."
    python3 -m venv "${VENV_DIR}"
fi

# 安装/升级依赖
echo "安装 Python 依赖..."
"${VENV_DIR}/bin/pip" install --upgrade pip
"${VENV_DIR}/bin/pip" install -r "${REQUIREMENTS}"

# 验证
echo "验证环境..."
"${VENV_DIR}/bin/python" - <<'PY'
import torch
import fitz
import PIL
print(f"  PyTorch: {torch.__version__}")
print(f"  PyMuPDF: {fitz.__doc__.split()[2] if fitz.__doc__ else 'unknown'}")
print(f"  Pillow: {PIL.__version__}")
PY

echo ""
echo "=============================================="
echo "环境准备完成"
echo "Python 路径: ${VENV_DIR}/bin/python"
echo ""
echo "运行方式:"
echo "  bun src/index.ts --docs a.pdf b.pdf --output ./result"
echo "=============================================="
