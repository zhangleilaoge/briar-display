#!/usr/bin/env python3
"""
BidDocComparator 安装脚本
安装依赖: pip install -r requirements.txt
"""
from setuptools import setup, find_packages

setup(
    name="bid-doc-comparator",
    version="1.0",
    description="施工方案文档比对工具 - 串标风险排查",
    author="AI Assistant",
    py_modules=["bid_doc_comparator"],
    install_requires=[
        "PyMuPDF>=1.23.0",
        "Pillow>=10.0.0",
        "numpy>=1.24.0",
        "scikit-learn>=1.3.0",
        "faiss-cpu>=1.7.0",
        "torch>=2.0.0",
        "torchvision>=0.15.0",
    ],
    python_requires=">=3.8",
    entry_points={
        "console_scripts": [
            "bid-compare=bid_doc_comparator:main",
        ],
    },
)
