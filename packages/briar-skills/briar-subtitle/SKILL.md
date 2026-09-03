---
name: briar-subtitle
description: 视频字幕提取：烧录字幕抽帧直读（无需下载模型）或 whisper 语音转录（带时间轴）。触发词："扒字幕"、"提取字幕"、"把视频里的话转成文字"、"视频字幕转文字"。
---

# briar-subtitle — 视频字幕提取

把本地视频文件中的字幕/口播内容提取为文字，输出带时间轴的版本和纯文本版本。

## 触发场景

- 用户给一个本地视频文件（mp4/mov 等），要求"扒字幕"、"提取字幕"、"把视频里说的话整理成文字"

## 方式选择（先判断，再执行）

| 场景 | 方式 | 理由 |
|------|------|------|
| 短视频（<5 分钟）且字幕烧录在画面上（抖音/B站常见） | **frames 抽帧直读** | 无需下载模型，几十秒出结果 |
| 长视频、无画面字幕、或需要精确时间轴 | **transcribe 语音转录** | 首次需下载 whisper 模型（约 1.5GB，几分钟），之后复用 |

拿不准时优先 frames：抽 1fps 帧图后用 ReadMediaFile 自己读画面字幕，逐批读取并按时间顺序拼接，注意去重（相邻帧字幕常重复）。

## 工作流

### Step 1 — 探测视频

```bash
bash video-subtitle.sh probe <video>
```

输出时长、音轨/字幕流信息。若视频内嵌独立字幕流（mov_text/subrip），直接 `ffmpeg -i <video> -map 0:s:0 out.srt` 导出即可，无需转录。

### Step 2a — 抽帧直读（首选）

```bash
bash video-subtitle.sh frames <video> [fps] [outdir]
# 默认 1fps，输出到 /tmp/subtitle-frames-<视频名>/
```

然后用 ReadMediaFile 逐批读帧图（每次 4-6 张），按文件名序号对应秒数整理出带时间轴的字幕。帧数过多（>120）时先提高 fps 间隔或裁剪字幕区域再读。

### Step 2b — 语音转录

```bash
bash video-subtitle.sh transcribe <video> [model]
# 默认模型 mlx-community/whisper-large-v3-turbo，语言中文
```

脚本自动准备环境（`~/.venvs/whisper` 隔离 venv + ffmpeg），输出带时间轴分段并保存 JSON 到 `/tmp/<视频名>_transcript.json`。

### Step 3 — 人工校对

whisper 输出常有同音错别字（如"下雨"→"下游"、"发备"→"翻倍"），结合上下文修正后再交付，修正处标注说明。

## 已知坑

- 本机无系统 ffmpeg：脚本用 `imageio-ffmpeg` pip 包自带的二进制，但其文件名不是 `ffmpeg`，mlx_whisper 按 `ffmpeg` 命令名调用会报 FileNotFoundError——脚本已自动做 symlink（`~/.venvs/whisper/ffmpeg-bin/ffmpeg`）并注入 PATH，不要绕过脚本直接调 mlx_whisper。
- 模型首次下载需几分钟（HF 未登录有限速），用后台任务跑，不要阻塞等待。
- 不要用系统 Python 3.9 装 whisper 生态，统一用脚本里的 uv 隔离 venv。
