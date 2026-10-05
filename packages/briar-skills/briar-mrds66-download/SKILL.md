---
name: briar-mrds66-download
description: 本机从 mrds66.com 档案页下载 HLS 视频为 mp4（curl 抠 DPlayer data-config → ffmpeg -c copy）。平台 key=mrds66，对齐网页「媒体解析」SUPPORTED_PLATFORMS 风格；此类暂不支持网页端 /api/media。触发词：mrds66、下载 mrds 视频、archives 视频。
tags: macos, mrds66, media, ffmpeg, hls, download
---

# briar-mrds66-download — mrds66 本机下视频

把 `https://www.mrds66.com/archives/<id>/` 一类页面的 HLS 流落到本机 mp4。**只走本地脚本**；网页工具箱「媒体解析」（`/api/media`）**暂不支持** `mrds66`。

## 平台 key（与网页枚举对齐）

网页端权威列表：`packages/briar-display/src/components/tools/ToolMediaSearchBar.tsx` → `SUPPORTED_PLATFORMS`。

| key | 网页端 | 本 skill |
|-----|--------|----------|
| `xiaohongshu` / `douyin` / `wechat` / `x` / `bilibili` / `pornhub` | ✅ `/api/media` | — |
| **`mrds66`** | ❌ 暂不支持网页端 | ✅ 本机 ffmpeg |

以后若接入网页，沿用同一 key `mrds66`，不要另起名字。后端 `detectPlatform()` 目前无此值；加识别时与前端一起改。

## 合规

- 成人向内容可以下。
- 标题、角色、文案或用户说明**明显涉及未成年** → **拒绝**，不下载、不给步骤。

## 依赖

| 项 | 说明 |
|----|------|
| `ffmpeg` | 本机安装；macOS 常见 `/opt/homebrew/bin/ffmpeg`，执行前把 `/opt/homebrew/bin` 放进 `PATH` |
| `curl` / `python3` | 拉页面、抠 `data-config` |
| 代理（可选） | 用户本机常驻 `http://127.0.0.1:7892`（自由猫）。**直连优先**；直连失败再挂 `http_proxy`/`https_proxy`。不要为了测连通去杀重启自由猫 |

## 已验证流程（摘要）

1. `curl` 页面 HTML → 从 DPlayer 的 `data-config` JSON 取 `video.url`（m3u8）。
2. `ffmpeg -headers "Referer: https://www.mrds66.com/\r\nUser-Agent: …" -i <m3u8> -c copy` 输出 mp4（常见 AES-128 HLS，直连通常可用）。
3. 实验室成功例：`archives/195302`（约 31 分）、`archives/195325`，默认落到 `$HOME/Downloads/`。

## 一键脚本

```bash
export PATH="/opt/homebrew/bin:$PATH"
bash packages/briar-skills/briar-mrds66-download/scripts/download.sh \
  'https://www.mrds66.com/archives/195302/' \
  "$HOME/Downloads"
# 可选第三参：自定义输出文件名（不含路径）；默认可从标题或 archives id 生成
```

成功标准：

- stdout 打印最终 mp4 绝对路径
- `ffprobe` 可读到时长（脚本末尾会跑）
- 文件非空且扩展名为 `.mp4`

## 手动步骤（脚本不可用时）

```bash
export PATH="/opt/homebrew/bin:$PATH"
HERE=packages/briar-skills/briar-mrds66-download/scripts
PAGE_URL='https://www.mrds66.com/archives/195302/'
UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
HTML=/tmp/mrds66.html
curl -fsSL -A "$UA" -e 'https://www.mrds66.com/' -o "$HTML" "$PAGE_URL"
M3U8=$(python3 "$HERE/extract_m3u8.py" "$HTML")
OUT="$HOME/Downloads/mrds66-195302.mp4"
ffmpeg -y -headers $'Referer: https://www.mrds66.com/\r\nUser-Agent: '"$UA"$'\r\n' \
  -i "$M3U8" -c copy "$OUT"
ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$OUT"
```

直连失败时：`export https_proxy=http://127.0.0.1:7892 http_proxy=http://127.0.0.1:7892` 后重试（不要杀自由猫）。

## 失败对照

| 现象 | 处理 |
|------|------|
| 无 `data-config` / 无 m3u8 | 确认是 archives 播放页；站点改版则更新抠取逻辑 |
| ffmpeg 403 / 握手失败 | 检查 Referer + UA；再试 `https_proxy=http://127.0.0.1:7892`（勿杀自由猫） |
| `ffmpeg: command not found` | `brew install ffmpeg`，并保证 `/opt/homebrew/bin` 在 PATH |
| 输出 0 字节 / 无时长 | 删残片后重跑；看是否付费墙或 m3u8 过期 |
| 用户指向明显未成年内容 | **拒绝**，停止 |

## 收尾

- 只交付本地路径与时长；不要把整页 HTML / m3u8 密钥刷进 chat。
- 不改网页 `/api/media`、不扩 `SUPPORTED_PLATFORMS`，除非用户明确要求上网页端。
- 技能落点：本仓库 `packages/briar-skills/briar-mrds66-download/`。
