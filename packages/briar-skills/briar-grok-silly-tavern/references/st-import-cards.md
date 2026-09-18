# SillyTavern：角色卡 / 世界书 / 关联 / 立绘

## 卡里到底有什么

SillyTavern `chara_card_v2` JSON 常见结构：

| 字段 | 含义 | 导入后行为 |
|------|------|------------|
| `data`（人设、开场、示例对话等） | 角色本体 | 成为角色卡 |
| `data.character_book` | **内嵌世界书**（entries） | **随角色导入，自动绑定到该角色**，一般不用再手动关联 |
| `data.avatar` | 头像：可能是 `https://…` URL，或空 | 见下文「立绘」 |
| `data.extensions.chub.related_lorebooks` | Chub **额外关联** lorebook 列表 | **不会**随卡自动进 ST 世界书；需另下另导，再手动/脚本绑定 |

**结论**：一张 Chub 卡可以同时是「角色 + 内嵌书」；若页面还挂了独立 lorebook（如 `$CHEESE Lore`），那是**第二份**世界书，要单独处理。

## Agent / 用户操作流程

### A. 导入角色（优先 PNG）

1. 用户给：`.json` / `.png` 卡文件，**或** Chub 角色页 URL。
2. 若是 URL：从页内 / `data.avatar` / `avatars.charhub.io/.../chara_card_v2.png` 拉 **PNG 卡**（立绘+元数据一体），比纯 JSON 更完整。
3. SillyTavern → 角色管理 → `#character_import_file` 上传；或 WebBridge `upload` 到该 input。
4. 清空旧卡（若用户要求）时删 `data/default-user/characters/*` 并 `getCharacters()` 刷新。

### B. 内嵌 `character_book`

- 导入角色后即生效，**不要**再复制进全局世界书（除非用户要全局共用）。
- 在角色编辑里可看到角色世界书条目；聊天时按关键词注入。

### C. 独立世界书（`related_lorebooks` / 用户另给的 lore JSON）

1. 从 Chub lorebook 页 **Export** 下载，或用户直接丢 `.json`。
2. API 直链常 **403**，优先：用户导出文件，或 WebBridge 登录态下点 Export。
3. ST → **世界书** 面板 → 导入（`#world_import_file`）。
4. **关联到角色**：打开该角色 → 世界书/角色世界书绑定 → 选刚导入的书（或设为全局启用）。不同 ST 版本 UI 文案可能是「绑定世界书 / Character Lorebook」。

### D. 立绘 / 头像

| 情况 | 做法 |
|------|------|
| JSON `avatar` 是 `https://avatars.charhub.io/.../chara_card_v2.png` | **直接下这个 PNG 当角色卡导入**（推荐） |
| `avatar` 为空或只是小图 URL | **向用户要 Chub 原始角色页 URL**，再从页面/`chara_card_v2.png` 规律路径拉立绘 |
| 只有 JSON、无网 | 导入后角色可能无图；之后用替换角色文件（Replace）补 PNG |

**Skill 约定**：导入前检查 `avatar`；缺图则停下来要 URL，不要默默导一张没脸的卡。

## 本机路径

- 角色：`~/Documents/github/SillyTavern/data/default-user/characters/`
- 世界书：`~/Documents/github/SillyTavern/data/default-user/worlds/`
- 临时下载：`~/Documents/github/st-import/`

## 示例（Jaq & Gus / Mouse Cafe）

- 角色页：`https://chub.ai/characters/Nezumin/jacque-augustine-mademouselle-sister-waitresses-mouse-cafe-570505ee6159`
- JSON 含 `character_book` ~112 条（内嵌，自动跟角色）
- `related_lorebooks`: `lorebooks/Nezumin/cheese-lore-0249a44afa9b`（`$CHEESE Lore`，需另导）
- 立绘卡：`https://avatars.charhub.io/avatars/Nezumin/jacque-augustine-mademouselle-sister-waitresses-mouse-cafe-570505ee6159/chara_card_v2.png`
