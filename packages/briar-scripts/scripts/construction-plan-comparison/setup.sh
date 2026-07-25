#!/usr/bin/env bash
set -e

# 施工方案比对工具环境一键安装脚本
# 创建 Python 虚拟环境并安装依赖

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="${SCRIPT_DIR}/python_encoder/.venv"
REQUIREMENTS="${SCRIPT_DIR}/python_encoder/requirements.txt"

# 跨平台适配
PYTHON_CMD="python3"
if ! command -v python3 &> /dev/null; then
    if command -v python &> /dev/null; then
        PYTHON_CMD="python"
    else
        echo "错误：未找到 python3/python，请先安装 Python 3.10+"
        exit 1
    fi
fi

# Windows (Git Bash / MSYS2) 虚拟环境脚本路径不同
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "mingw"* ]]; then
    VENV_PYTHON="${VENV_DIR}/Scripts/python.exe"
    VENV_PIP="${VENV_DIR}/Scripts/pip.exe"
else
    VENV_PYTHON="${VENV_DIR}/bin/python"
    VENV_PIP="${VENV_DIR}/bin/pip"
fi

echo "=============================================="
echo "BidDocComparator 环境准备"
echo "=============================================="

PY_VERSION=$(${PYTHON_CMD} -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
echo "Python 命令: ${PYTHON_CMD}"
echo "Python 版本: ${PY_VERSION}"

# 创建虚拟环境
if [ -d "${VENV_DIR}" ]; then
    echo "虚拟环境已存在: ${VENV_DIR}"
else
    echo "创建虚拟环境..."
    "${PYTHON_CMD}" -m venv "${VENV_DIR}"
fi

# 安装/升级依赖
echo "安装 Python 依赖..."
# Windows 下直接运行 pip.exe 升级会锁定自身，改用 python -m pip
"${VENV_PYTHON}" -m pip install --upgrade pip
"${VENV_PYTHON}" -m pip install -r "${REQUIREMENTS}"

# 验证
echo "验证环境..."
"${VENV_PYTHON}" - <<'PY'
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
echo "Python 路径: ${VENV_PYTHON}"
echo ""
echo "运行方式:"
echo "  bun src/index.ts --docs a.pdf b.pdf --output ./result"
echo "=============================================="
