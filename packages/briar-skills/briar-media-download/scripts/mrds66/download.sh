#!/usr/bin/env bash
# mrds66 archives page -> local mp4 (HLS -c copy)
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

PAGE_URL="${1:-}"
OUT_DIR="${2:-$HOME/Downloads}"
OUT_NAME="${3:-}"

UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
REFERER='https://www.mrds66.com/'
HERE="$(cd "$(dirname "$0")" && pwd)"

if [[ -z "$PAGE_URL" ]]; then
  echo "usage: $0 <archives-url> [outdir] [filename.mp4]" >&2
  exit 2
fi

if ! command -v ffmpeg >/dev/null; then
  echo "ffmpeg not found; brew install ffmpeg && ensure /opt/homebrew/bin is on PATH" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"

ARCH_ID="$(printf '%s' "$PAGE_URL" | sed -nE 's|.*/archives/([0-9]+).*|\1|p')"
[[ -n "$ARCH_ID" ]] || ARCH_ID="mrds66-$(date +%Y%m%d%H%M%S)"

TMP_HTML="$(mktemp -t mrds66.XXXXXX.html)"
cleanup() { rm -f "$TMP_HTML"; }
trap cleanup EXIT

curl_page() {
  curl -fsSL --connect-timeout 20 --max-time 120 \
    -A "$UA" -e "$REFERER" "$@"
}

echo "fetch $PAGE_URL" >&2
if ! curl_page -o "$TMP_HTML" "$PAGE_URL"; then
  echo "direct fetch failed; retry via 127.0.0.1:7892" >&2
  curl_page -x 'http://127.0.0.1:7892' -o "$TMP_HTML" "$PAGE_URL"
fi

TITLE="$(python3 "$HERE/page_title.py" "$TMP_HTML")"

if printf '%s' "$TITLE" | grep -Eiq '未成年|幼女|萝莉幼|正太幼|underage|\bchild\b|\bchildren\b|\bminor\b|\bpedo'; then
  echo "refused: title suggests underage content: $TITLE" >&2
  exit 3
fi

M3U8="$(python3 "$HERE/extract_m3u8.py" "$TMP_HTML")"

if [[ -z "$OUT_NAME" ]]; then
  SAFE="$(python3 "$HERE/safe_name.py" "$TITLE" "$ARCH_ID")"
  OUT_NAME="${SAFE}.mp4"
fi
case "$OUT_NAME" in
  *.mp4|*.MP4) ;;
  *) OUT_NAME="${OUT_NAME}.mp4" ;;
esac

OUT_PATH="$OUT_DIR/$OUT_NAME"
HEADERS=$'Referer: https://www.mrds66.com/\r\nUser-Agent: '"$UA"$'\r\n'

echo "m3u8=$M3U8" >&2
echo "out=$OUT_PATH" >&2

run_ffmpeg() {
  ffmpeg -hide_banner -loglevel error -stats -y \
    -headers "$HEADERS" \
    -i "$M3U8" \
    -c copy \
    "$OUT_PATH"
}

if ! run_ffmpeg; then
  echo "ffmpeg direct failed; retry via proxy 7892" >&2
  export http_proxy='http://127.0.0.1:7892'
  export https_proxy='http://127.0.0.1:7892'
  export HTTP_PROXY="$http_proxy"
  export HTTPS_PROXY="$https_proxy"
  run_ffmpeg
fi

SIZE="$(wc -c < "$OUT_PATH" | tr -d ' ')"
if [[ "$SIZE" -lt 1000 ]]; then
  echo "output too small ($SIZE bytes): $OUT_PATH" >&2
  exit 1
fi

DUR="$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$OUT_PATH" 2>/dev/null || true)"
echo "platform=mrds66"
echo "title=$TITLE"
echo "path=$OUT_PATH"
echo "bytes=$SIZE"
echo "duration_sec=${DUR:-unknown}"
