# SillyTavern 防复读（Chat Completion）

社区共识：这不是 ST 程序 bug，而是 **上下文 pattern lock / 复读机**——历史里一旦出现固定开场/收束，模型会越学越像。网页端常是新短对话，所以对照会「网页正常、酒馆怪」。

## 适用症状

- 每轮同一套骨架，只把用户原文嵌进固定口头禅
- 例如反复出现「杯子…没响」「把这 N 个字又咬了一遍」「别让我对着空杯子把…再解释一遍」
- 角色卡里未必写过这些中文套话（可先 `strings`/抽卡确认）

## 立刻止血（优先顺序）

1. **清污染历史**：Swipe / 删除带模板的几轮；严重则 **新开聊天** 或从「尚未复读」处分支。这比只调参更有效。
2. **Chat Completion 惩罚**（OpenAI 兼容；grok2api 同样走这组字段）：
   - `presence_penalty`：**0.6–1.0**（本机默认落地 **0.8**）
   - `frequency_penalty`：**0.3–0.6**（本机默认落地 **0.4**）
   - 温度可略降到 **0.8–0.9**（可选）
3. **Author's Note**（聊天元数据 `note_prompt`）+ **世界书常驻条目**（`constant: true`），禁止具体套句并要求每轮换开场/节奏。
4. 本地后端才主打 DRY / rep_pen；走 grok API 时以前三条为主。

## 本机落盘位置（实验室）

根目录：`~/Documents/github/SillyTavern/data/default-user/`

| 项 | 路径 / 字段 |
|----|-------------|
| 当前 OAI 惩罚 | `settings.json` → `oai_settings.pres_pen_openai` / `freq_pen_openai` |
| 预设 | `OpenAI Settings/Default.json` → `presence_penalty` / `frequency_penalty` |
| 全局世界书勾选 | `settings.json` → `world_info_settings.world_info.globalSelect` 含 `Anti-Repetition` |
| 世界书文件 | `worlds/Anti-Repetition.json`（条目 `constant: true`） |
| 某局 Author's Note | `chats/<Char>/<chat>.jsonl` 首行 `chat_metadata.note_prompt`（及 `note_interval=1`, `note_depth=4`, `note_role=0`） |

改完文件后：**硬刷新 ST 页面**（必要时重启 ST）再生成，避免内存里旧设置覆盖。

## 推荐 Note / 世界书文案

```text
[Anti-Repetition / 防复读]
- 禁止复用上一轮的开场、收束、口头禅或段落骨架；每轮必须换开场与节奏。
- 禁止及同义改写：「杯子在木台上还是没响」「把这N个字又咬了一遍」「别让我对着空杯子把…再解释一遍」。
- 不要把用户原话嵌进固定口头禅；对白与动作比例轮换。
- 保持角色语气与人设，但句式、意象、段落顺序必须变化。
```

可按当前聊天里实际套话增补「禁止」清单。

## 助手操作清单

当用户抱怨酒馆复读、套模板、网页没有问题时：

1. 统计最近助手回复里重复开场/收束次数，确认是 pattern lock。
2. 检查角色卡是否写死套话；没有则主因是历史。
3. 写入/更新惩罚参数与 `Anti-Repetition` 世界书；必要时写入当前聊天 `note_prompt`。
4. 告诉用户硬刷新，并建议 Swipe/删污染轮或新开聊。
5. **不要**为了换节点去反复杀重启 Clash/自由猫（用户明确禁止）。

## 社区参考（概念对齐）

- r/SillyTavernAI：历史复读会毒化后续；清历史 + 惩罚/换句指令
- ST 文档：Author's Note 可强制回复格式；Common Settings 中的 repetition / DRY（本地）
- 中文 FAQ「复读机」：调温、惩罚、清上下文
