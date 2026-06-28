# 施工方案比对工具后续优化 TODO

## 1. 性能优化

- [x] 文本提取：将 `pdf-parse` 替换为 PyMuPDF，提升中文与表格提取质量
- [ ] 图片比对：图片量上万时引入 FAISS/hnswlib 做近似最近邻，降低 O(n²) 开销
- [x] Python IPC：图片编码改为流水线模式（3 batch 并发），重叠发送与等待时间
- [ ] 模型推理：尝试将 ResNet18 导出为 ONNX，用 `onnxruntime-node` 替代 Python 子进程
- [x] 输出序列化：大数据量时支持 MessagePack，替代纯 JSON

## 2. 报告交互与可用性

- [x] 文本差异高亮：像 Git diff 一样标红增删改
- [x] 表格结构比对：提取表格后按单元格对比，而不是当普通文本处理
- [x] 筛选与排序：按文档、页码、相似度区间筛选图片对/文本对
- [x] 分页懒加载：文本对和非标段段落前端分页，减少 DOM 体积
- [x] 导出功能：支持导出 CSV（文本对、非标段落、图片对清单）
- [x] 报告瘦身：`report_data.json` 中文本对/非标段落通过 chunk ID 引用，减少重复文本

## 3. 算法效果提升

- [ ] ~~非标段落检测：叠加 embedding 相似度、关键字段匹配，可选接入 LLM~~（用户明确不需要大模型）
- [ ] 图片比对模型：评估 CLIP 或文档截图领域模型替代 ResNet18
- [ ] 文本语义相似：增加 embedding 相似度作为 n-gram 的补充

## 4. 工程健壮性

- [x] PDF 容错：加密、损坏、扫描版 PDF 优雅降级或明确提示
- [ ] ~~OCR 能力：集成 PaddleOCR 等方案处理扫描件文字~~（用户明确不需要）
- [x] Python 环境自动化：提供 `setup.sh` 一键创建 venv、安装依赖
- [x] Python 错误提示：统一 Python 路径解析，识别依赖缺失并提示 setup.sh
- [x] 断点续跑：支持从提取/编码/比对中间步骤恢复

## 5. 可维护性

- [x] 配置文件：支持 `bid-compare.config.toml` 管理阈值、输出目录、模型路径
- [x] 结构化日志：用 Logger 替代 console.log，支持 info/warn/error/debug 级别
- [x] 性能基准测试：新增 `bun run benchmark`，固定 PDF 跑耗时/产物大小，防止回归
- [x] 类型安全：用更精确的类型状态区分 ImageItem 的“未保存/已保存/已编码”阶段

## 优先级（建议先做）

1. [x] 文本差异高亮 + ~~表格结构比对~~
2. [x] PyMuPDF 替换 pdf-parse
3. [x] 添加配置文件和 setup 脚本
4. [x] 表格结构比对（下一阶段）
