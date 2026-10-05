---
name: briar-media-download
description: 通用媒体下载/解析路由。平台 key 与网页「媒体解析」对齐（xiaohongshu/douyin/wechat/x/bilibili/pornhub + mrds66）。网页已支持的优先推荐用户用工具箱自助；mrds66 等仅本地站点用本机 ffmpeg。触发词：媒体解析、下视频、无水印、mrds66、小红书/抖音/B站/Pornhub 下载。
tags: macos, media, download, ffmpeg, xiaohongshu, douyin, bilibili, pornhub, mrds66
---

# briar-media-download — 通用媒体下载

统一入口：先识别链接平台，再决定**网页自助**还是**本机脚本**。

## 平台枚举（必须对齐）

权威定义在前端：

| 常量 | 文件 | 取值 |
|------|------|------|
| `MEDIA_PLATFORMS` | `packages/briar-display/src/components/tools/toolMediaUtils.ts` | `xiaohongshu` `douyin` `wechat` `x` `bilibili` `pornhub` **`mrds66`** |
| `WEB_MEDIA_PLATFORMS` | 同上 | 不含 `mrds66`（网页图标条 / 已实现解析） |

后端识别：`packages/briar-node/src/routes/media.ts` → `detectPlatform()`（内部 `xhs` → 结果字段仍是 `xiaohongshu`）。`mrds66` **暂未**进 `/api/media`。

文档：`docs/media.md`。

**不要另起一套平台名。** 新站点先加进 `MEDIA_PLATFORMS`，再决定是否实现网页端。

## Agent 决策流程

```
收到链接 / 「帮我下这个视频」
  ↓
识别 platform（按下表 / URL host）
  ↓
├─ 属于 WEB_MEDIA_PLATFORMS
│     → **优先推荐**用户打开网页工具箱「媒体解析」自助（免登录、有历史）
│     → 仅当用户**明确坚持本机脚本**时，再参考 briar-node 对应 `*MediaService.ts` 写/跑本地逻辑
│
└─ platform = mrds66（或其它「仅本地」）
      → 走本 skill 的本机脚本；写明「暂不支持网页 /api/media」
```

线上入口：`https://xiaobuzi.cn/briar/` 工具箱 → 媒体解析（以实际部署为准）。

## 平台 → 能力

| platform | 网页 `/api/media` | 本机 |
|----------|-------------------|------|
| `xiaohongshu` | ✅ | 可选；参考 `services/xhsMediaService.ts` |
| `douyin` | ✅ | 可选；参考 `services/douyinMediaService.ts` |
| `wechat` | ✅ | 可选；参考 `services/wechatMediaService.ts` |
| `x` | ✅ | 可选；参考 `routes/media.ts` fxtwitter |
| `bilibili` | ✅ | 可选；参考 `services/bilibiliMediaService.ts` |
| `pornhub` | ✅（需出站代理） | 可选；参考 `services/pornhubMediaService.ts` |
| **`mrds66`** | ❌ 暂不支持 | ✅ `scripts/mrds66/download.sh` |

### URL 粗识别

| host 特征 | platform |
|-----------|----------|
| `xiaohongshu.com` / `xhslink.com` / `xhslink.cn` | `xiaohongshu` |
| `douyin.com` / `iesdouyin.com` | `douyin` |
| `mp.weixin.qq.com` | `wechat` |
| `x.com` / `twitter.com` | `x` |
| `bilibili.com` / `b23.tv` | `bilibili` |
| `pornhub.com` | `pornhub` |
| `mrds66.com` + `/archives/` | `mrds66` |

## 合规

- 成人向可以下。
- 标题/角色/文案或用户说明**明显未成年** → **拒绝**，不给下载步骤。

## 网络与工具

- **直连优先**；失败再用 `http://127.0.0.1:7892`（自由猫）。不要为测连通杀重启自由猫。
- macOS：`export PATH="/opt/homebrew/bin:$PATH"`，需要 `ffmpeg` / `ffprobe` / `curl` / `python3`。

## mrds66（仅本地，已验证）

流程：curl 页面 → DPlayer `data-config.video.url`（HLS m3u8，常 AES-128）→ `ffmpeg -headers "Referer: https://www.mrds66.com/\r\nUser-Agent: …" -i m3u8 -c copy` → mp4。

```bash
export PATH="/opt/homebrew/bin:$PATH"
bash packages/briar-skills/briar-media-download/scripts/mrds66/download.sh \
  'https://www.mrds66.com/archives/195302/' \
  "$HOME/Downloads"
```

成功：stdout 含 `platform=mrds66`、`path=`、`duration_sec=`；文件非空。实验室例：`archives/195302`（约 31 分）、`195325`。

辅助脚本同目录：`extract_m3u8.py` / `page_title.py` / `safe_name.py`。

### 失败对照（mrds66）

| 现象 | 处理 |
|------|------|
| 无 data-config | 确认 archives 播放页；站点改版则更新 `extract_m3u8.py` |
| ffmpeg 403 | 查 Referer/UA；再挂 `7892` |
| `ffmpeg: command not found` | `brew install ffmpeg` |
| 明显未成年标题 | 脚本 exit 3；Agent 拒绝 |

## 网页已支持平台：本机脚本原则

1. 先劝网页自助，说明更快、有历史与代理缓存。
2. 用户坚持本地时：读对应 `packages/briar-node/src/services/*MediaService.ts`（及 `docs/media.md`），**复用同一套解析思路**，不要另发明 API。
3. Pornhub / 部分海外 CDN 本机也需代理；签名 URL 常绑出口 IP。
4. 不要把 cookie / 密钥贴进 chat。

## 收尾

- 交付：平台 key、路径（网页操作说明或本地文件路径）、时长/体积（若有）。
- 未要求时不要改 `/api/media` 实现；枚举已在 `MEDIA_PLATFORMS` 含 `mrds66`。
- 技能落点：`packages/briar-skills/briar-media-download/`。
