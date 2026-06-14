#!/usr/bin/env bash
# obsidian.sh — Obsidian vault management for agent knowledge base
# Usage: obsidian.sh <command> [args...]
set -euo pipefail

VAULT="${BRIAR_VAULT:-$HOME/briar-vault}"

# ─── Helpers ──────────────────────────────────────────────────────────────────

die() { echo "Error: $*" >&2; exit 1; }

ensure_vault() {
  [[ -d "$VAULT" ]] || die "Vault not found at $VAULT. Run: obsidian.sh init"
}

resolve_path() {
  local p="$1"
  [[ "$p" != *.md ]] && p="${p}.md"
  echo "$VAULT/$p"
}

get_frontmatter() {
  local file="$1" key="$2"
  sed -n '/^---$/,/^---$/p' "$file" | grep "^${key}:" | head -1 | sed "s/^${key}:* *//"
}

# ─── Commands ─────────────────────────────────────────────────────────────────

cmd_init() {
  if [[ -d "$VAULT/.obsidian" ]]; then
    echo "Vault already initialized at $VAULT"
    return 0
  fi

  mkdir -p "$VAULT"/{0-inbox,1-projects,2-areas,3-resources/{tools,frameworks},4-archives,templates,attachments}

  cat > "$VAULT/templates/default.md" << 'TEMPLATE'
---
title: "{{title}}"
created: {{date}}
updated: {{date}}
tags: []
aliases: []
status: active
---

# {{title}}

TEMPLATE

  mkdir -p "$VAULT/.obsidian"
  cat > "$VAULT/.obsidian/app.json" << 'OBSIDIAN'
{
  "showLineNumber": true,
  "strictLineBreaks": false,
  "readableLineLength": true,
  "livePreview": true,
  "attachmentFolderPath": "attachments",
  "newFileLocation": "folder",
  "newFileFolderPath": "0-inbox"
}
OBSIDIAN

  cat > "$VAULT/.obsidian/appearance.json" << 'OBSIDIAN'
{
  "baseFontSize": 16,
  "theme": "obsidian"
}
OBSIDIAN

  cat > "$VAULT/.gitignore" << 'GIT'
.obsidian/workspace.json
.obsidian/workspace-mobile.json
.trash/
GIT

  echo "Vault initialized at $VAULT"
  find "$VAULT" -maxdepth 2 -type d | sed "s|$VAULT|.|g" | sort
}

cmd_write() {
  local path="" content="" title="" tags="" status="active"

  while [[ $# -gt 0 ]]; do
    case "$1" in
      -c|--content) content="$2"; shift 2;;
      -t|--title)   title="$2"; shift 2;;
      --tags)       tags="$2"; shift 2;;
      --status)     status="$2"; shift 2;;
      *)            path="$1"; shift;;
    esac
  done

  [[ -z "$path" ]] && die "Usage: obsidian.sh write <path> -c <content> [-t title] [--tags t1,t2]"

  local file
  file=$(resolve_path "$path")
  mkdir -p "$(dirname "$file")"

  local today
  today=$(date +%Y-%m-%d)
  [[ -z "$title" ]] && title=$(basename "$path" .md)

  local tags_yaml="[]"
  if [[ -n "$tags" ]]; then
    tags_yaml="[$(echo "$tags" | sed 's/,/, /g')]"
  fi

  local already_existed=false
  [[ -f "$file" ]] && already_existed=true

  local fm_created="$today"
  if $already_existed; then
    local existing_created
    existing_created=$(get_frontmatter "$file" "created")
    [[ -n "$existing_created" ]] && fm_created="$existing_created"
  fi

  {
    printf -- '---\n'
    printf -- 'title: "%s"\n' "$title"
    printf -- 'created: %s\n' "$fm_created"
    printf -- 'updated: %s\n' "$today"
    printf -- 'tags: %s\n' "$tags_yaml"
    printf -- 'status: %s\n' "$status"
    printf -- '---\n\n'
    printf -- '# %s\n\n' "$title"
    printf -- '%s\n' "$content"
  } > "$file"

  if $already_existed; then
    echo "Updated: $file"
  else
    echo "Created: $file"
  fi
}

cmd_read() {
  local path="$1"
  [[ -z "$path" ]] && die "Usage: obsidian.sh read <path>"
  local file
  file=$(resolve_path "$path")
  [[ -f "$file" ]] || die "Note not found: $path"
  cat "$file"
}

cmd_list() {
  local folder="${1:-}"
  local dir="$VAULT"
  if [[ -n "$folder" ]]; then
    dir="$VAULT/$folder"
    [[ -d "$dir" ]] || die "Folder not found: $folder"
  fi
  echo "📂 $(basename "$dir")/"
  find "$dir" -maxdepth 3 -name "*.md" -type f | sort | while read -r f; do
    local rel="${f#$VAULT/}"
    local title
    title=$(get_frontmatter "$f" "title" 2>/dev/null || basename "$f" .md)
    local tags
    tags=$(get_frontmatter "$f" "tags" 2>/dev/null || echo "")
    [[ -n "$tags" ]] && tags="  $tags"
    echo "  📄 $rel — $title$tags"
  done
}

cmd_search() {
  local query="$1"
  [[ -z "$query" ]] && die "Usage: obsidian.sh search <query>"
  echo "🔍 Searching: $query"
  echo "---"
  find "$VAULT" -name "*.md" -not -path "*/.obsidian/*" -exec grep -il "$query" {} + 2>/dev/null | while read -r f; do
    local rel="${f#$VAULT/}"
    local title
    title=$(get_frontmatter "$f" "title" 2>/dev/null || basename "$f" .md)
    echo "📄 $rel — $title"
    grep -n -i "$query" "$f" | head -3 | sed 's/^/  /'
    echo ""
  done | head -50
}

cmd_link() {
  local from="$1" to="$2"
  [[ -z "$from" || -z "$to" ]] && die "Usage: obsidian.sh link <from> <to>"
  local file
  file=$(resolve_path "$from")
  [[ -f "$file" ]] || die "Note not found: $from"
  local to_name
  to_name=$(basename "$to" .md)
  if grep -q "\[\[$to_name\]\]" "$file" 2>/dev/null; then
    echo "Link already exists: [[$to_name]] in $from"
  else
    echo "" >> "$file"
    echo "See also [[${to_name}]]" >> "$file"
    echo "Added link: [[$to_name]] → $from"
  fi
}

cmd_tags() {
  echo "🏷️  All tags in vault:"
  echo "---"
  find "$VAULT" -name "*.md" -not -path "*/.obsidian/*" -exec grep -h "^tags:" {} + 2>/dev/null \
    | sed 's/tags: *\[//;s/\]//;s/,/\n/g' \
    | sed 's/^ *//;s/ *$//' \
    | grep -v '^$' \
    | sort | uniq -c | sort -rn
}

cmd_graph() {
  ensure_vault
  local total_notes total_links total_tags
  total_notes=$(find "$VAULT" -name "*.md" -not -path "*/.obsidian/*" | wc -l)
  total_links=$(grep -rh '\[\[' "$VAULT" --include="*.md" 2>/dev/null | grep -o '\[\[[^]]*\]\]' | wc -l)
  total_tags=$(grep -rh '^tags:' "$VAULT" --include="*.md" 2>/dev/null | sed 's/tags: *\[//;s/\]//;s/,/\n/g' | sed 's/^ *//;s/ *$//' | grep -v '^$' | sort -u | wc -l)

  echo "📊 Knowledge Graph Stats"
  echo "  Notes:    $total_notes"
  echo "  Links:    $total_links"
  echo "  Tags:     $total_tags"
  echo ""

  echo "🔗 Most referenced notes:"
  grep -roh '\[\[[^]]*\]\]' "$VAULT" --include="*.md" 2>/dev/null \
    | sed 's/\[\[//;s/\]\]//' \
    | sort | uniq -c | sort -rn | head -10 \
    | sed 's/^/  /'
  echo ""

  echo "📝 Notes with most outgoing links:"
  for f in $(find "$VAULT" -name "*.md" -not -path "*/.obsidian/*"); do
    local count
    count=$(grep -o '\[\[[^]]*\]\]' "$f" 2>/dev/null | wc -l)
    if [[ $count -gt 0 ]]; then
      local rel="${f#$VAULT/}"
      echo "  $count links — $rel"
    fi
  done | sort -rn | head -10 || true
}

cmd_migrate() {
  local notes_dir="${1:-$HOME/notes}"
  [[ -d "$notes_dir" ]] || die "Notes directory not found: $notes_dir"
  echo "📦 Migrating $notes_dir → $VAULT/0-inbox/"
  find "$notes_dir" -name "*.md" -type f | while read -r f; do
    local name
    name=$(basename "$f" .md)
    local today
    today=$(date +%Y-%m-%d)
    local target="$VAULT/0-inbox/$name.md"
    {
      printf -- '---\n'
      printf -- 'title: "%s"\n' "$name"
      printf -- 'created: %s\n' "$today"
      printf -- 'updated: %s\n' "$today"
      printf -- 'tags: [migrated]\n'
      printf -- 'status: active\n'
      printf -- '---\n\n'
      cat "$f"
    } > "$target"
    echo "  ✅ $name.md"
  done
  echo "Migration complete. Check $VAULT/0-inbox/"
}

# ─── Main ─────────────────────────────────────────────────────────────────────

cmd="${1:-help}"
shift || true

case "$cmd" in
  init)     cmd_init "$@";;
  write)    cmd_write "$@";;
  read)     cmd_read "$@";;
  list)     cmd_list "$@";;
  search)   cmd_search "$@";;
  link)     cmd_link "$@";;
  tags)     cmd_tags "$@";;
  graph)    cmd_graph "$@";;
  migrate)  cmd_migrate "$@";;
  help|*)
    cat << 'HELP'
obsidian.sh — Obsidian vault management

Usage:
  obsidian.sh init                              Initialize vault at ~/briar-vault
  obsidian.sh write <path> -c <content>         Create/update note
                        [-t title] [--tags t1,t2]
  obsidian.sh read <path>                       Read note
  obsidian.sh list [folder]                     List notes
  obsidian.sh search <query>                    Search notes
  obsidian.sh link <from> <to>                  Add wikilink
  obsidian.sh tags                              List all tags
  obsidian.sh graph                             Knowledge graph stats
  obsidian.sh migrate [notes_dir]              Migrate ~/notes/ to vault

Environment:
  BRIAR_VAULT    Vault path (default: ~/briar-vault)
HELP
    ;;
esac
