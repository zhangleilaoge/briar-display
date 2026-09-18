#!/usr/bin/env bash
# Rebuild SillyTavern list thumbnail from the character PNG on disk.
# Use after replacing characters/*.png outside the ST UI (stale ? placeholder otherwise).
# Usage: fix_st_avatar_thumb.sh "Jaq & Gus.png"
set -euo pipefail
ST_HOME="${ST_HOME:-${BRIAR_ST_HOME:-$HOME/Documents/github/SillyTavern}}"
name="${1:-}"
[[ -n "$name" ]] || { echo "usage: $0 <CharacterFile.png>" >&2; exit 1; }
char="$ST_HOME/data/default-user/characters/$name"
[[ -f "$char" ]] || { echo "ERROR: missing $char" >&2; exit 1; }
thumb_dir="$ST_HOME/data/default-user/thumbnails/avatar"
mkdir -p "$thumb_dir"
thumb="$thumb_dir/$name"
rm -f "$thumb"
# ST often serves ~96x144; keep aspect from card
if command -v sips >/dev/null 2>&1; then
  sips -z 144 96 "$char" --out "$thumb" >/dev/null
elif command -v magick >/dev/null 2>&1; then
  magick "$char" -resize 96x144 "$thumb"
else
  cp "$char" "$thumb"
  echo "WARN: no sips/magick; copied full card as thumb" >&2
fi
touch "$char"
file "$thumb"
echo "OK: $thumb — hard-refresh ST (Cmd+Shift+R) if UI still shows placeholder."
