# Examples — SillyTavern character cards

本目录放 **SillyTavern `chara_card_v2`** 示例卡，供 bootstrap / 联调时导入 Characters。

| 文件 | 说明 |
|------|------|
| `harribel-court-card.example.json` | **瘦身元数据**（可安全贴进文档讨论）：Bleach / Harribel's Court，仅 name/tags/extensions 摘要 |
| `harribel-court-card.full.json` | **完整 NSFW chara_card_v2**（用户附件同款类型）。**不要**把全文贴进 `SKILL.md`；仅在本地 ST 导入 |

## 导入到 SillyTavern

1. 打开 ST → **Characters**
2. Import / 拖入 `harribel-court-card.full.json`（或用户自有卡）
3. 选中角色后，确认 API 已指向 grok2api（见 SKILL.md「接线」）

## 注意

- 完整卡可能含成人向内容；仅用于私人本地实例。
- 技能文档只引用本目录路径，不内联 NSFW 正文。
