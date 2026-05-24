# BidDocComparator - 施工方案文档比对工具

从多份PDF投标/施工方案文档中提取图片和文本，进行交叉比对，找出相似度高的图片对和段落对，辅助串标风险排查。

---

## 一、环境准备

### 1. 安装Python

需要 Python 3.8 或更高版本。

```bash
python --version
```

### 2. 安装依赖

```bash
pip install pymupdf pillow numpy scikit-learn faiss-cpu torch torchvision
```

如果安装较慢，可以用国内镜像：

```bash
pip install pymupdf pillow numpy scikit-learn faiss-cpu torch torchvision -i https://pypi.tuna.tsinghua.edu.cn/simple
```

**依赖说明：**

| 包 | 用途 |
|---|---|
| pymupdf | PDF解析（提取图片和文本） |
| pillow | 图片处理 |
| numpy | 数值计算 |
| scikit-learn | TF-IDF文本编码 |
| faiss-cpu | 向量相似度搜索（Facebook开源） |
| torch / torchvision | 图片向量化（ResNet神经网络） |

**硬件要求：**

- 最低：CPU + 8GB内存
- 推荐：CPU + 16GB内存（处理1000页+文档时）
- GPU加速可选（需NVIDIA显卡+CUDA）：将 `--device cuda` 传入命令行

---

## 二、快速开始

### 推荐用法 - 使用 workspace 目录

1. **把需要比对的PDF文件放到 `workspace/` 目录下**
2. **直接运行：**

```bash
python bid_doc_comparator.py --workspace ./workspace --output ./result
```

> 程序会自动读取 `workspace/` 目录下所有 `.pdf` 文件进行比对。

---

## 三、其他用法

### 手动指定PDF文件

```bash
python bid_doc_comparator.py --docs a.pdf b.pdf --output ./result
```

### 比对3份文档

```bash
python bid_doc_comparator.py --docs doc1.pdf doc2.pdf doc3.pdf --output ./result
```

### 使用通配符批量比对

```bash
python bid_doc_comparator.py --docs *.pdf --output ./result
```

---

## 四、命令行参数

| 参数 | 说明 | 默认值 |
|---|---|---|
| `--docs` | PDF文档路径列表（与 `--workspace` 二选一） | - |
| `--workspace` | PDF文档存放目录（自动读取所有PDF） | `./workspace` |
| `--output` | 结果输出目录 | `./bid_compare_result` |
| `--img-threshold` | 图片相似度阈值（0~1） | `0.85` |
| `--text-threshold` | 文本相似度阈值（0~1） | `0.80` |
| `--device` | 计算设备：`cpu` 或 `cuda` | `cpu` |
| `--batch-size` | 图片编码批次大小 | `32` |

### 示例

```bash
# 使用 workspace 目录（推荐）
python bid_doc_comparator.py --workspace ./workspace --output ./result

# 提高图片相似度阈值（更严格，减少结果数量）
python bid_doc_comparator.py --workspace ./workspace --img-threshold 0.90

# 降低文本相似度阈值（更宽松，增加结果数量）
python bid_doc_comparator.py --workspace ./workspace --text-threshold 0.75

# 使用GPU加速图片编码
python bid_doc_comparator.py --workspace ./workspace --device cuda
```

---

## 五、查看结果

运行完成后，在 `--output` 指定的目录中会生成以下文件：

| 文件 | 说明 |
|---|---|
| `report.html` | **可视化HTML报告**（用浏览器打开即可） |
| `report.txt` | 纯文本报告 |
| `results.json` | JSON格式完整数据 |
| `compare.log` | 运行日志 |
| `docN_xxx/images/` | 各文档提取的图片 |

### 打开报告

```bash
# Mac
open report.html

# Windows
start report.html

# Linux
xdg-open report.html
```

或者直接双击 `report.html` 用浏览器打开。

> **注意：** 每次运行会自动清空输出目录，避免旧产物干扰。

---

## 六、报告内容说明

HTML报告包含三个板块：

### 1. 图片比对结果

- 提取每份PDF中的所有图片，用ResNet神经网络转换为特征向量
- 跨文档两两比对相似度
- 列出相似度高于阈值的所有图片对
- **相似度解读：**
  - `1.0` = 完全相同（MD5一致）
  - `0.95~1.0` = 极高相似（可能为同一图片的缩放/裁剪）
  - `0.90~0.95` = 高相似（需要人工审查）
  - `0.85~0.90` = 中相似（可能相关）

### 2. 文本比对结果

- 将PDF文本拆分为段落
- 使用TF-IDF字符级n-gram编码
- 跨文档比对段落相似度
- 列出相似度高于阈值的段落对

### 3. 非标内容筛选（低频N-gram）

- 自动识别在文档中仅出现1-3次的低频字符序列
- 这些段落通常包含**设备型号、具体参数、品牌名称**等"不该重复却可能重复"的内容
- 已自动过滤目录、章节标题等标准化内容

---

## 七、完整示例流程

假设你有3份投标文档，放在 `workspace/` 目录下：

```bash
# 1. 进入工具所在目录
cd /path/to/bid_doc_comparator

# 2. 确认 workspace 中有PDF文件
ls workspace/
# 甲公司.pdf  乙公司.pdf  丙公司.pdf

# 3. 运行比对
python bid_doc_comparator.py --workspace ./workspace --output ./result

# 4. 等待执行完成（3份200页文档约需3-5分钟）

# 5. 查看报告
open ./result/report.html
```

控制台输出示例：

```
[Workspace] Found 3 PDF files in workspace
[Step 1/4] Extracting PDF content...
  doc1: 696 images, 199 paragraphs
  doc2: 706 images, 199 paragraphs
  doc3: 718 images, 186 paragraphs
[Step 2/4] Comparing images...
  Image matches (>0.85): 70
[Step 3/4] Comparing texts...
  Text matches (>0.80): 22
[Step 4/4] Generating reports...
COMPLETED in 245.3s
  Image matches: 70
  Text matches: 22
  Output: /path/to/result
    report.html - Visual HTML report
    report.txt  - Text report
    results.json - Detailed JSON data
```

---

## 八、常见问题

**Q: 安装faiss-cpu失败怎么办？**

A: 尝试以下命令：

```bash
# 方式1：conda安装（推荐）
conda install -c pytorch faiss-cpu

# 方式2：指定版本
pip install faiss-cpu==1.7.4

# 方式3：从源码编译（如果以上都失败）
pip install faiss-cpu --no-cache-dir
```

**Q: 处理大文档时内存不足？**

A: 降低批次大小：

```bash
python bid_doc_comparator.py --workspace ./workspace --batch-size 16
```

**Q: 如何只比对图片或只比对文本？**

A: 当前版本会同时执行两项比对。如需只关注图片结果，可在HTML报告中忽略文本部分。

**Q: CUDA/GPU加速没效果？**

A: 确认：

1. NVIDIA显卡驱动已安装
2. CUDA Toolkit已安装 (`nvidia-smi` 能输出信息)
3. PyTorch CUDA版本正确：`python -c "import torch; print(torch.cuda.is_available())"` 应输出 `True`

**Q: 可以比对多少份文档？**

A: 理论上任意数量。实测建议同时比对不超过10份（内存限制）。更多文档建议分批比对。

---

## 九、文件清单

```
bid_doc_comparator.py   # 主程序（唯一需要运行的文件）
README.md               # 本说明文档
workspace/              # 放置PDF文件的目录（用户自建）
```

只需要把PDF放进 `workspace/` 目录，然后运行主程序即可。首次运行时会自动下载PyTorch模型（约45MB，保存在本地缓存，仅需下载一次）。
