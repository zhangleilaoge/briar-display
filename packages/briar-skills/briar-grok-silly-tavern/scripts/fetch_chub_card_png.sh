#!/usr/bin/env bash
# Given a Chub character fullPath or card JSON, download chara_card_v2.png for ST import.
# Usage:
#   fetch_chub_card_png.sh Nezumin/jacque-...-570505ee6159
#   fetch_chub_card_png.sh /path/to/card.json
set -euo pipefail
OUT_DIR="${ST_IMPORT_DIR:-$HOME/Documents/github/st-import}"
mkdir -p "$OUT_DIR"
arg="${1:-}"
[[ -n "$arg" ]] || { echo "usage: $0 <chub-fullPath|card.json>" >&2; exit 1; }

full_path=""
if [[ -f "$arg" ]]; then
  full_path=$(python3 - "$arg" <<'PY'
import json,sys
d=json.load(open(sys.argv[1]))
data=d.get("data") or d
ch=(data.get("extensions") or {}).get("chub") or {}
print(ch.get("full_path") or "")
av=data.get("avatar") or ""
if av.endswith("chara_card_v2.png"):
    print("AVATAR_URL="+av)
PY
)
  av_line=$(echo "$full_path" | grep '^AVATAR_URL=' || true)
  full_path=$(echo "$full_path" | grep -v '^AVATAR_URL=' | head -1)
  if [[ -n "${av_line}" ]]; then
    url="${av_line#AVATAR_URL=}"
  fi
else
  full_path="$arg"
fi

if [[ -z "${url:-}" ]]; then
  [[ -n "$full_path" ]] || { echo "ERROR: no full_path / avatar URL" >&2; exit 1; }
  url="https://avatars.charhub.io/avatars/${full_path}/chara_card_v2.png"
fi

slug=$(echo "${full_path:-card}" | tr '/' '_')
out="$OUT_DIR/${slug}.png"
echo "INFO: GET $url"
curl -fsSL -A 'Mozilla/5.0' -o "$out" "$url"
file "$out"
echo "OK: $out"
echo "Import this PNG in SillyTavern Character Management (preferred over bare JSON)."
