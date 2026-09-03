#!/usr/bin/env bash
# briar-subtitle: 视频字幕提取辅助脚本
# 用法:
#   video-subtitle.sh probe <video>
#   video-subtitle.sh frames <video> [fps] [outdir]
#   video-subtitle.sh transcribe <video> [model]
set -euo pipefail

VENV="$HOME/.venvs/whisper"
DEFAULT_MODEL="mlx-community/whisper-large-v3-turbo"

find_ffmpeg() {
	if command -v ffmpeg >/dev/null 2>&1; then
		command -v ffmpeg
		return
	fi
	if [ -x "$VENV/ffmpeg-bin/ffmpeg" ]; then
		echo "$VENV/ffmpeg-bin/ffmpeg"
		return
	fi
	if [ -x "$VENV/bin/python" ]; then
		"$VENV/bin/python" -c "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())" 2>/dev/null && return
	fi
	echo "ERROR: 找不到 ffmpeg，请先运行 transcribe 初始化环境，或自行安装 ffmpeg" >&2
	return 1
}

ensure_venv() {
	if ! command -v uv >/dev/null 2>&1; then
		echo "ERROR: 需要 uv（https://docs.astral.sh/uv/）" >&2
		return 1
	fi
	if [ ! -x "$VENV/bin/python" ]; then
		uv venv "$VENV" --python 3.11 >&2
	fi
	if ! "$VENV/bin/python" -c "import mlx_whisper, imageio_ffmpeg" >/dev/null 2>&1; then
		uv pip install --python "$VENV/bin/python" mlx-whisper imageio-ffmpeg >&2
	fi
	# imageio-ffmpeg 的二进制文件名不是 ffmpeg，mlx_whisper 按命令名调用，需 symlink
	mkdir -p "$VENV/ffmpeg-bin"
	ln -sf "$("$VENV/bin/python" -c "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())")" "$VENV/ffmpeg-bin/ffmpeg"
}

cmd_probe() {
	local video="$1"
	local ffmpeg
	ffmpeg="$(find_ffmpeg)"
	"$ffmpeg" -i "$video" 2>&1 | grep -E 'Duration|Stream' || true
}

cmd_frames() {
	local video="$1"
	local fps="${2:-1}"
	local base
	base="$(basename "$video")"
	base="${base%.*}"
	local outdir="${3:-/tmp/subtitle-frames-$base}"
	local ffmpeg
	ffmpeg="$(find_ffmpeg)"
	mkdir -p "$outdir"
	"$ffmpeg" -y -i "$video" -vf "fps=$fps" "$outdir/frame_%04d.jpg" 2>&1 | tail -1
	local count
	count=$(ls "$outdir"/frame_*.jpg 2>/dev/null | wc -l | tr -d ' ')
	echo "已抽取 ${count} 帧到 ${outdir}（fps=${fps}，frame_0001.jpg 起按序等间隔排列）"
}

cmd_transcribe() {
	local video="$1"
	local model="${2:-$DEFAULT_MODEL}"
	ensure_venv
	local ffmpeg
	ffmpeg="$(find_ffmpeg)"
	local base
	base="$(basename "$video")"
	base="${base%.*}"
	local wav="/tmp/${base}.wav"
	local json="/tmp/${base}_transcript.json"
	"$ffmpeg" -y -i "$video" -vn -ac 1 -ar 16000 "$wav" 2>/dev/null
	PATH="$VENV/ffmpeg-bin:$PATH" "$VENV/bin/python" - "$wav" "$model" "$json" <<'PYEOF'
import json
import sys

import mlx_whisper

wav, model, out = sys.argv[1], sys.argv[2], sys.argv[3]
result = mlx_whisper.transcribe(wav, path_or_hf_repo=model, language="zh", word_timestamps=False)
segs = [{"start": round(s["start"], 1), "end": round(s["end"], 1), "text": s["text"].strip()} for s in result["segments"]]
with open(out, "w", encoding="utf-8") as f:
    json.dump(segs, f, ensure_ascii=False, indent=1)
print(f"共 {len(segs)} 段，JSON 已保存到 {out}")
for s in segs:
    print(f'[{s["start"]:>7.1f}-{s["end"]:>7.1f}] {s["text"]}')
PYEOF
}

main() {
	local cmd="${1:-}"
	case "$cmd" in
		probe)
			[ $# -ge 2 ] || { echo "用法: video-subtitle.sh probe <video>" >&2; exit 1; }
			cmd_probe "$2"
			;;
		frames)
			[ $# -ge 2 ] || { echo "用法: video-subtitle.sh frames <video> [fps] [outdir]" >&2; exit 1; }
			cmd_frames "$2" "${3:-1}" "${4:-}"
			;;
		transcribe)
			[ $# -ge 2 ] || { echo "用法: video-subtitle.sh transcribe <video> [model]" >&2; exit 1; }
			cmd_transcribe "$2" "${3:-$DEFAULT_MODEL}"
			;;
		*)
			echo "用法: video-subtitle.sh {probe|frames|transcribe} <video> [args...]" >&2
			exit 1
			;;
	esac
}

main "$@"
