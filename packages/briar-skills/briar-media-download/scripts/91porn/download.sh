#!/usr/bin/env bash
# 91porn view_video page -> local mp4 (direct progressive, not HLS)
# Do NOT use yt-dlp (site rejected as Piracy).
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

PAGE_URL="${1:-}"
OUT_DIR="${2:-$HOME/Downloads}"
OUT_NAME="${3:-}"

UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
REFERER='https://91porn.com/'
PROXY='http://127.0.0.1:7892'
HERE="$(cd "$(dirname "$0")" && pwd)"

if [[ -z "$PAGE_URL" ]]; then
  echo "usage: $0 <view_video-url> [outdir] [filename.mp4]" >&2
  exit 2
fi

mkdir -p "$OUT_DIR"

VIEWKEY="$(printf '%s' "$PAGE_URL" | sed -nE 's|.*[?&]viewkey=([^&]+).*|\1|p')"
[[ -n "$VIEWKEY" ]] || VIEWKEY="91porn-$(date +%Y%m%d%H%M%S)"

TMP_HTML="$(mktemp -t 91porn.XXXXXX.html)"
cleanup() { rm -f "$TMP_HTML"; }
trap cleanup EXIT

curl_get() {
  # $1 = out path or - ; remaining args = URL etc via "$@"
  local out="$1"; shift
  curl -fsSL --connect-timeout 20 --max-time 180 \
    -A "$UA" -e "$REFERER" -L -o "$out" "$@"
}

echo "fetch $PAGE_URL" >&2
if ! curl_get "$TMP_HTML" "$PAGE_URL"; then
  echo "direct fetch failed; retry via 127.0.0.1:7892" >&2
  curl_get "$TMP_HTML" -x "$PROXY" "$PAGE_URL"
fi

TITLE="$(python3 "$HERE/page_title.py" "$TMP_HTML")"

if printf '%s' "$TITLE" | grep -Eiq '未成年|幼女|萝莉幼|正太幼|underage|\bchild\b|\bchildren\b|\bminor\b|\bpedo|\bloli\b|\bshota\b'; then
  echo "refused: title suggests underage content: $TITLE" >&2
  exit 3
fi

MP4_URL="$(python3 "$HERE/extract_mp4.py" "$TMP_HTML")"

if [[ -z "$OUT_NAME" ]]; then
  SAFE="$(python3 "$HERE/safe_name.py" "$TITLE" "$VIEWKEY")"
  OUT_NAME="${SAFE}.mp4"
fi
case "$OUT_NAME" in
  *.mp4|*.MP4) ;;
  *) OUT_NAME="${OUT_NAME}.mp4" ;;
esac

OUT_PATH="$OUT_DIR/$OUT_NAME"

echo "mp4=$MP4_URL" >&2
echo "out=$OUT_PATH" >&2

download_mp4() {
  local use_proxy="${1:-}"
  if [[ -n "$use_proxy" ]]; then
    curl -fL --connect-timeout 20 --max-time 600 \
      -A "$UA" -e "$REFERER" -x "$PROXY" \
      -o "$OUT_PATH" "$MP4_URL"
  else
    curl -fL --connect-timeout 20 --max-time 600 \
      -A "$UA" -e "$REFERER" \
      -o "$OUT_PATH" "$MP4_URL"
  fi
}

if ! download_mp4; then
  echo "mp4 direct failed; retry via proxy 7892" >&2
  download_mp4 proxy
fi

SIZE="$(wc -c < "$OUT_PATH" | tr -d ' ')"
if [[ "$SIZE" -lt 1000 ]]; then
  echo "output too small ($SIZE bytes): $OUT_PATH" >&2
  exit 1
fi

DUR="unknown"
if command -v ffprobe >/dev/null; then
  DUR="$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$OUT_PATH" 2>/dev/null || true)"
  DUR="${DUR:-unknown}"
fi

echo "platform=91porn"
echo "title=$TITLE"
echo "path=$OUT_PATH"
echo "bytes=$SIZE"
echo "duration_sec=${DUR}"
