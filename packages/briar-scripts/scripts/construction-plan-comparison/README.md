# BidDocComparator v2.0 (TypeScript + Python 混合架构)

施工方案文档比对工具 — 从多份 PDF 投标/施工方案文档中提取图片、文本和表格，进行交叉比对，找出相似度高的图片对、文本段落对和表格对，辅助串标风险排查。

## 架构说明

为了在不牺牲图片比对精度的前提下迁移到 TypeScript，采用混合架构：

| 模块 | 实现 | 说明 |
|:---|:---|:---|
| CLI / 文本比对 / 表格比对 / 报告生成 | TypeScript + Bun | 主流程、类型安全、模块化 |
| PDF 文本/表格/图片提取 | Python + `PyMuPDF` | 子进程，中文与表格提取更稳定 |
| 图片向量化 | Python + PyTorch ResNet18 | 子进程，与原版行为一致 |

## 环境准备

### 1. Bun

确保已安装 Bun：`bun --version`

### 2. Python 虚拟环境

一键安装（推荐）：

```bash
./setup.sh
```

或手动安装：

```bash
cd python_encoder
uv venv
uv pip install -r requirements.txt
```

> 如果没有 `uv`，也可以直接用 `python3 -m venv .venv && .venv/bin/pip install -r requirements.txt`

## 快速开始

把要比对的 PDF 放入 `input/` 目录（至少 2 个），然后：

```bash
bun run compare
```

产物默认输出到 `./bid_compare_result/`。

## 常用脚本

| 脚本 | 说明 |
|:---|:---|
| `bun run compare` | 读取 `input/` 目录下的 PDF 进行比对 |
| `bun run compare:resume` | 复用缓存重新跑 |
| `bun run compare:cli -- --docs a.pdf b.pdf` | 通过 CLI 直接指定 PDF |
| `bun run clean` | 删除 `bid_compare_result` 和缓存 |
| `bun run test` | 运行测试 |
| `bun run check` | 类型检查 + 代码规范检查 |
| `bun run benchmark` | 性能基准测试 |

## 运行方式

```bash
# 读取 input/ 目录（推荐）
bun run compare

# 复用缓存
bun run compare:resume

# 直接传参
bun run compare:cli -- --docs a.pdf b.pdf --output ./result

# 从仓库根目录
bun run --filter @briar/scripts bid-compare -- --docs ...
```

## 配置文件

支持 `bid-compare.config.toml`，CLI 参数会覆盖配置文件。复制示例文件：

```bash
cp bid-compare.config.example.toml bid-compare.config.toml
```

示例配置：

```toml
output = "./bid_compare_result"
# docs = ["doc1.pdf", "doc2.pdf"]
# python_path = "./python_encoder/.venv/bin/python"
# resume = false
# output_format = "json"

[thresholds]
img = 0.7
text = 0.5
table = 0.6

[text]
chunk_size = 300
chunk_overlap = 30

[image]
min_size = 32
min_area = 8000
group_threshold = 0.8
batch_size = 32
max_show = 500
```

## 命令行参数

| 参数 | 说明 | 默认值 |
|---|---|---|
| `--docs` | PDF 文档路径列表 | `input/` 目录下所有 PDF，或配置文件中的 `docs` |
| `--output` | 结果输出目录 | `./bid_compare_result` |
| `--img-threshold` | 图片相似度阈值 | `0.70` |
| `--text-threshold` | 文本相似度阈值 | `0.50` |
| `--table-threshold` | 表格相似度阈值 | `0.60` |
| `--chunk-size` | 文本块大小（字符） | `300` |
| `--img-min-area` | 图片最小像素面积，过滤页码/小图标 | `8000` |
| `--img-group-threshold` | 图片聚类阈值 | `0.80` |
| `--resume` | 复用缓存的文本/表格/图片编码结果 | `false` |
| `--output-format` | 结果数据格式：`json` / `msgpack` | `json` |

## 输出文件

| 文件 | 说明 |
|---|---|
| `index.html` | 交互式 HTML 报告 |
| `index.all-in-one.html` | 单文件 HTML 报告，图片内嵌 base64，可直接转发 |
| `report_data.json` | 完整比对结果数据 |
| `table_pairs.csv` | 相似表格对清单 |
| `text_pairs.csv` | 相似文本对清单 |
| `image_pairs.csv` | 相似图片对清单 |
| `special_paragraphs.csv` | 非标段落清单 |
| `compare.log` | 运行日志 |

## 图片比对交互

- 相似图片已按组聚类，默认过滤掉仅同文档重复的组。
- **点击图片** → 放大预览。
- **点击图片下方“第X页 WxH”文本** → 选中该图。
- 选中后高亮同组最关联的图，并在文本后显示相似度：
  - 绿色：相似度 ≥ 95%
  - 黄色：相似度 ≥ 90%
  - 红色：相似度 ≥ 80%
- 选中图文本后显示 `(原图)`。

## 项目结构

```
src/
├── index.ts              # CLI 入口
├── types.ts              # 类型定义
├── config.ts             # 默认配置
├── logger.ts             # 日志工具
├── cache.ts              # 断点续跑缓存
├── pdf/
│   ├── text-extractor.ts # PDF 文本/表格提取
│   └── image-extractor.ts# 调用 Python 子进程提取图片
├── compare/
│   ├── image-compare.ts  # 调用 Python 子进程编码图片 + 比对 + 聚类
│   ├── text-compare.ts   # 文本比对
│   ├── table-compare.ts  # 表格结构比对
│   └── special-finder.ts # 非标内容筛选
└── report/
    ├── index.ts          # 报告生成
    ├── all-in-one.ts     # 单文件报告
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
- 新增图片聚类分组、单文件 all-in-one 报告、断点续跑缓存
