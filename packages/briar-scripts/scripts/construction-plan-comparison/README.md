# BidDocComparator v2.0 (TypeScript + Python 混合架构)

施工方案文档比对工具 — 从多份 PDF 投标/施工方案文档中提取图片和文本，进行交叉比对，找出相似度高的图片对和段落对，辅助串标风险排查。

## 架构说明

为了在不牺牲图片比对精度的前提下迁移到 TypeScript，采用混合架构：

| 模块 | 实现 | 说明 |
|:---|:---|:---|
| CLI / 文本比对 / 报告生成 | TypeScript + Bun | 主流程、类型安全、模块化 |
| PDF 文本提取 | `pdf-parse` | 纯 TS |
| PDF 图片提取 | Python + `PyMuPDF` | 子进程，与原版行为一致 |
| 图片向量化 | Python + PyTorch ResNet18 | 子进程，与原版行为一致 |

这样图片比对效果与 Python 原版几乎一致。

## 环境准备

### 1. Bun

确保已安装 Bun：`bun --version`

### 2. Python 虚拟环境

```bash
cd python_encoder
uv venv
uv pip install -r requirements.txt
```

> 如果没有 `uv`，也可以直接用 `python3 -m venv .venv && .venv/bin/pip install -r requirements.txt`

## 运行方式

```bash
# 从仓库根目录
cd packages/briar-scripts
bun run bid-compare -- --docs ./scripts/construction-plan-comparison/a.pdf ./scripts/construction-plan-comparison/b.pdf --output ./result

# 或直接在该目录
bun src/index.ts --docs a.pdf b.pdf --output ./result

# 读取 input/ 目录下的 PDF
bun src/index.ts --output ./result
```

## 命令行参数

| 参数 | 说明 | 默认值 |
|---|---|---|
| `--docs` | PDF 文档路径列表 | `input/` 目录下所有 PDF |
| `--output` | 结果输出目录 | `./bid_compare_result` |
| `--img-threshold` | 图片相似度阈值 | `0.70` |
| `--text-threshold` | 文本相似度阈值 | `0.50` |
| `--chunk-size` | 文本块大小（字符） | `300` |

## 输出文件

| 文件 | 说明 |
|---|---|
| `index.html` | 交互式 HTML 报告（仅展示前 500 对图片） |
| `report_data.json` | 完整比对结果数据 |
| `compare.log` | 运行日志 |

## 项目结构

```
src/
├── index.ts              # CLI 入口
├── types.ts              # 类型定义
├── config.ts             # 默认配置
├── logger.ts             # 日志工具
├── pdf/
│   ├── text-extractor.ts # PDF 文本提取
│   └── image-extractor.ts# 调用 Python 子进程提取图片
├── compare/
│   ├── image-compare.ts  # 调用 Python 子进程编码图片 + 比对
│   ├── text-compare.ts   # 文本比对
│   └── special-finder.ts # 非标内容筛选
└── report/
    ├── index.ts          # 报告生成
    └── js-logic.ts       # 前端交互 JS
python_encoder/
├── image_extractor.py    # PyMuPDF 图片提取
├── image_encoder.py      # PyTorch ResNet18 图片编码
└── requirements.txt
```

## 与原版 Python 的差异

- 主流程、CLI、报告生成从 Python 迁移到 TypeScript
- 图片提取和向量化保留 Python/PyTorch，保证比对质量
- 文本比对、非标筛选算法与原版一致
