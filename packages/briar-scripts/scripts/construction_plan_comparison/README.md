# BidDocComparator - 施工方案文档比对工具 v2.0

从多份PDF投标/施工方案文档中提取图片和文本，进行交叉比对，找出相似度高的图片对和段落对，辅助串标风险排查。

---

## 一、环境准备

### 1. 安装 Python

需要 Python 3.10 或更高版本（建议 < 3.11，以兼容 PyTorch  wheel）。

```bash
python --version
```

### 2. 安装依赖

使用 [uv](https://docs.astral.sh/uv/) 管理依赖：

```bash
uv sync
```

如果没有 uv，可以先安装：

```bash
pip install uv
```

**依赖说明：**

| 包 | 用途 |
|---|---|
| PyMuPDF | PDF 解析（提取图片和文本） |
| Pillow | 图片处理 |
| numpy | 数值计算 |
| torch / torchvision | 图片向量化（ResNet 神经网络） |

**硬件要求：**

- 最低：CPU + 8GB 内存
- 推荐：CPU + 16GB 内存（处理 1000 页+ 文档时）
- GPU 加速可选（需 NVIDIA 显卡 + CUDA）：将 `--device cuda` 传入命令行

---

## 二、快速开始

### 基本用法 - 比对 2 份文档

```bash
uv run bid_doc_comparator.py --docs a.pdf b.pdf --output ./result
```

### 比对 3 份文档

```bash
uv run bid_doc_comparator.py --docs doc1.pdf doc2.pdf doc3.pdf --output ./result
```

### 使用通配符批量比对

```bash
uv run bid_doc_comparator.py --docs *.pdf --output ./result
```

---

## 三、命令行参数

| 参数 | 说明 | 默认值 |
|---|---|---|
| `--docs` | PDF 文档路径列表（至少 2 个） | 默认读取 `input/` 目录 |
| `--output` | 结果输出目录 | `./bid_compare_result` |
| `--img-threshold` | 图片相似度阈值（0~1） | `0.70` |
| `--text-threshold` | 文本相似度阈值（0~1） | `0.50` |
| `--device` | 计算设备：`cpu` 或 `cuda` | `cpu` |
| `--chunk-size` | 文本块大小（字符） | `300` |

### 示例

```bash
# 提高图片相似度阈值（更严格，减少结果数量）
uv run bid_doc_comparator.py --docs a.pdf b.pdf --img-threshold 0.90

# 降低文本相似度阈值（更宽松，增加结果数量）
uv run bid_doc_comparator.py --docs a.pdf b.pdf --text-threshold 0.40

# 使用 GPU 加速图片编码
uv run bid_doc_comparator.py --docs a.pdf b.pdf --device cuda

# 调整文本块大小（更大块 = 更快但粒度更粗）
uv run bid_doc_comparator.py --docs a.pdf b.pdf --chunk-size 500
```

---

## 四、查看结果

运行完成后，在 `--output` 指定的目录中会生成以下文件：

| 文件 | 说明 |
|---|---|
| `index.html` | **交互式 HTML 报告**（用浏览器打开即可） |
| `compare.log` | 运行日志 |

### 打开报告

```bash
# Mac
open index.html

# Windows
start index.html

# Linux
xdg-open index.html
```

或者直接双击 `index.html` 用浏览器打开。

---

## 五、报告内容说明

HTML 报告为深色主题的交互式单页应用，包含四大板块：

### 1. 图片比对

- 提取每份 PDF 中的所有图片，用 ResNet18 神经网络转换为特征向量
- 跨文档两两比对余弦相似度
- 结果以**左右对照**形式展示，点击图片可放大查看
- **相似度解读：**
  - `1.0` = 完全相同（MD5 一致）
  - `0.95~1.0` = 极高相似（可能为同一图片的缩放/裁剪）
  - `0.90~0.95` = 高相似（需要人工审查）
  - `0.70~0.90` = 中相似（可能相关）

### 2. 相似文本对

- 将 PDF 文本按固定长度拆分为文本块（默认 300 字符）
- 使用**字符级 3-gram** 进行相似度比对
- 已自动过滤标准化内容（封面、招标文件原文、目录等）
- 鼠标悬停文本块可查看完整内容
- 支持分页浏览

### 3. 非标内容筛选（低频 N-gram）

- 自动识别在文档中仅出现 1~3 次的低频字符序列
- 这些段落通常包含**设备型号、具体参数、品牌名称**等"不该重复却可能重复"的内容
- 已自动过滤目录、章节标题等标准化内容
- 支持按文档筛选、按设备型号筛选、按非标度>0.9 筛选

### 4. 关键词查询

- 输入关键词（设备型号、品牌名、技术参数等），在所有文档段落中实时搜索
- 支持多关键词空格分隔
- 支持按文档筛选、高亮匹配

---

## 六、完整示例流程

假设你有 3 份投标文档：`甲公司.pdf`、`乙公司.pdf`、`丙公司.pdf`

```bash
# 1. 进入工具所在目录
cd /path/to/bid_doc_comparator

# 2. 运行比对（以这 3 份文档为例）
uv run bid_doc_comparator.py \
    --docs 甲公司.pdf 乙公司.pdf 丙公司.pdf \
    --output ./result

# 3. 等待执行完成（3 份 200 页文档约需 2~5 分钟）

# 4. 查看报告
open ./result/index.html
```

控制台输出示例：

```
============================================================
BidDocComparator v2.0 | 文本块 300 字符
============================================================
文档: 3
图片阈值: 0.7
文本阈值: 0.5
设备: cpu

[1/5] 初始化图片编码器...

[2/5] 提取文本（块大小 300 字符）...
  doc1: 320 块
  doc2: 315 块
  doc3: 330 块
  总计: 965 块

[3/5] 提取图片...
  doc1: 120 张
  doc2: 115 张
  doc3: 118 张
  总计: 353 张

[4/5] 图片比对...
  相似图片对: 45

[5/5] 文本比对...
  text done: 62 matches
  相似文本对: 62

[额外] 非标内容筛选...
  非标段落: 28

生成报告...

============================================================
完成! 耗时: 125.3 秒
  图片对: 45
  文本对: 62
  非标段: 28
  报告: result/index.html
============================================================
```

---

## 七、常见问题

**Q: 处理大文档时内存不足？**

A: 可以尝试增大文本块大小（减少块数量）：

```bash
uv run bid_doc_comparator.py --docs big.pdf --chunk-size 500
```

**Q: 如何只比对图片或只比对文本？**

A: 当前版本会同时执行两项比对。如需只关注某一部分，可在 HTML 报告中忽略其他板块。

**Q: CUDA/GPU 加速没效果？**

A: 确认：

1. NVIDIA 显卡驱动已安装
2. CUDA Toolkit 已安装 (`nvidia-smi` 能输出信息)
3. PyTorch CUDA 版本正确：`python -c "import torch; print(torch.cuda.is_available())"` 应输出 `True`

**Q: 可以比对多少份文档？**

A: 理论上任意数量。实测建议同时比对不超过 10 份（内存限制）。更多文档建议分批比对。

---

## 八、文件清单

```
bid_doc_comparator.py   # 主程序 (v2.0)
bid_doc_comparator_v1.py # 旧版 v1.0 备份
pyproject.toml          # uv 依赖配置
README.md               # 本说明文档
```

使用 `uv run` 即可自动安装依赖并运行。首次运行时会自动下载 PyTorch 模型（约 45MB，保存在本地缓存，仅需下载一次）。
