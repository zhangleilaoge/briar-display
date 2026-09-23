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
2. **Chub API 全站 geo 封锁**：`api.chub.ai` / `chub.ai/api` 直连 curl 403「not available in your country」，**挂代理也 403**（ASN 级）。只能走 WebBridge 浏览器导出（已验证）：
   - `navigate` 到 lorebook 页 → **CDP 可信点击**（`Input.dispatchMouseEvent`）点 Export 按钮打开菜单（合成 `el.click()` 打不开菜单）→ 菜单项「SillyTavern World Info」是 React `<li>`，**合成 `li.click()` 即可**触发下载，文件落 `~/Downloads`（文件名形如 `main_<书名>_world_info.json`，导入后可重命名为干净的世界书名）
   - 真实下载地址规律（备选）：`https://gateway.chub.ai/api/v4/projects/{lorebookId}/repository/files/raw%2Fsillytavern_raw.json/raw?ref=main&response_type=blob`，`lorebookId` 即 `related_lorebooks[].id`
3. ST → **世界书** 面板 → 导入（`#world_import_file`）；或 API：`POST /api/worldinfo/import`（注意**不是** `/api/worlds`），multipart 字段名 `avatar`。
4. **关联到角色**：打开该角色 → 世界书/角色世界书绑定 → 选刚导入的书（或设为全局启用）。不同 ST 版本 UI 文案可能是「绑定世界书 / Character Lorebook」。API 方式：`POST /api/characters/edit` 顶层带 `world: "<世界书名>"`（需带 `json_data` 原文保住嵌入书）。

### D. 立绘 / 头像

| 情况 | 做法 |
|------|------|
| JSON `avatar` 是 `https://avatars.charhub.io/.../chara_card_v2.png` | **直接下这个 PNG 当角色卡导入**（推荐） |
| `avatar` 为空或只是小图 URL | **向用户要 Chub 原始角色页 URL**，再从页面/`chara_card_v2.png` 规律路径拉立绘 |
| 只有 JSON、无网 | 导入后角色可能无图；之后用替换角色文件（Replace）补 PNG |

**Skill 约定**：导入前检查 `avatar`；缺图则停下来要 URL，不要默默导一张没脸的卡。


### E. 坑：列表头像是问号 / 「没有头像」

常见原因：**先用纯 JSON 导入**（`avatar: none` / 只有 URL 未嵌入），ST 会在

`data/default-user/thumbnails/avatar/<角色名>.png`

写下 **问号占位图**。之后即使用磁盘替换 `characters/*.png` 立绘，**缩略图不会自动更新**，UI 仍显示没头像。

正确做法：

1. **始终优先用 `chara_card_v2.png` 经 ST 导入**（不要先 JSON 再偷偷覆盖文件）。
2. 若已踩坑：删坏缩略图并重建：

```bash
bash scripts/fix_st_avatar_thumb.sh "Jaq & Gus.png"
```

3. 浏览器对 ST **硬刷新**（Cmd+Shift+R）。

### F. 「一张卡里两个人」≠ 两个角色

Chub 上常见 **双人同卡**（如 `Jaq & Gus`）：`data.name` 一个、文件一个、ST 角色列表一项；立绘/人设里出现两姐妹是设定，不是导成两张卡。需要单人卡时另找角色，不要拆这份 PNG。

## 本机路径

- 角色：`~/Documents/github/SillyTavern/data/default-user/characters/`
- 世界书：`~/Documents/github/SillyTavern/data/default-user/worlds/`
- 临时下载：`~/Documents/github/st-import/`

## 坑：WebBridge upload 与 ST API 直连

- WebBridge `upload` 到 `#character_import_file` 需要 Chrome 给扩展开「允许访问文件网址」（默认关）→ 报错就让用户去 `chrome://extensions` 开，或**直接走 ST 服务端 API**（推荐，无需浏览器）。
- ST API 直连（已验证）：`disableCsrfProtection: false` 时 POST 必须带会话 cookie + CSRF token：

```bash
JAR=/tmp/st_cookie.jar
TOKEN=$(curl -sS -c $JAR http://127.0.0.1:8001/csrf-token | python3 -c 'import json,sys;print(json.load(sys.stdin)["token"])')
# 导入角色 PNG 卡
curl -sS -b $JAR -c $JAR -X POST http://127.0.0.1:8001/api/characters/import \
  -H "X-CSRF-Token: $TOKEN" -F "avatar=@/path/to/card.png;type=image/png" -F "file_type=png"
# 读卡 / 改卡（如绑全局世界书：body 顶层加 "world": "Cheese Lore"）
# POST /api/characters/get {"avatar_url":"X.png"} → 改完 POST /api/characters/edit（需带 json_data 原文保嵌入书）
# 注意 /edit 的 body 是**平铺字段**不是 get 响应原样回传：必须有 ch_name（缺了报 "Error: invalid name"），
# description/first_mes/system_prompt/post_history_instructions/tags/alternate_greetings 等全在顶层；
# get 响应里 data.* 嵌套的要自行拍平，post_history_instructions 读顶层（charaFormatData，ST 1.14 源码确认）。
# 主动生成缩略图（避免懒加载前显示占位）：
curl -sS -b $JAR -o /dev/null 'http://127.0.0.1:8001/thumbnail?type=avatar&file=X.png'
```

完整流程（Dora / Mollie 已两次验证）：读 JSON 的 `avatar` → charhub URL 直接下 PNG → API import → `/edit` 绑世界书 → 触发 thumbnail → 浏览器硬刷新。

## 示例（Jaq & Gus / Mouse Cafe）

- 角色页：`https://chub.ai/characters/Nezumin/jacque-augustine-mademouselle-sister-waitresses-mouse-cafe-570505ee6159`
- JSON 含 `character_book` ~112 条（内嵌，自动跟角色）
- `related_lorebooks`: `lorebooks/Nezumin/cheese-lore-0249a44afa9b`（`$CHEESE Lore`，需另导）
- 立绘卡：`https://avatars.charhub.io/avatars/Nezumin/jacque-augustine-mademouselle-sister-waitresses-mouse-cafe-570505ee6159/chara_card_v2.png`
