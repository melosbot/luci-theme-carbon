#!/bin/sh
#
# Assemble the GitHub release body: one complete section per language.
#
#   sh scripts/release-notes.sh TAG [owner/repo] > notes.md
#
#   ## English          docs/releases/TAG.en.md     + install.en.md
#   ---
#   ## 简体中文          docs/releases/TAG.zh-CN.md  + install.zh-CN.md
#
# Each TAG file holds "### What's new" / "### 更新内容" and, when needed,
# "### Upgrade notes" / "### 升级须知". Releases before v1.2 used one mixed
# file, docs/releases/TAG.md; it is printed unchanged above both sections.
# RELEASE_NOTES_DIR overrides docs/releases (tests).
#
set -eu

TAG=${1:?usage: sh scripts/release-notes.sh TAG [owner/repo]}
REPO=${2:-mrjoechen/luci-theme-carbon}
DIR=${RELEASE_NOTES_DIR:-$(cd "$(dirname "$0")/.." && pwd)/docs/releases}

printf '%s\n' "$REPO" | grep -Eq '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$' || { echo "invalid repository: $REPO" >&2; exit 1; }
printf '%s\n' "$TAG" | grep -Eq '^v[0-9]+\.[0-9]+\.[0-9]+$' || { echo "invalid tag: $TAG" >&2; exit 1; }

install_text() { sed "s#@REPOSITORY@#$REPO#g" "$DIR/install.$1.md"; }

if [ -f "$DIR/$TAG.md" ]; then
	cat "$DIR/$TAG.md"
	printf '\n---\n\n'
fi

printf '## English\n\n'
if [ -f "$DIR/$TAG.en.md" ]; then cat "$DIR/$TAG.en.md"; printf '\n'; fi
install_text en

printf '\n---\n\n## 简体中文\n\n'
if [ -f "$DIR/$TAG.zh-CN.md" ]; then cat "$DIR/$TAG.zh-CN.md"; printf '\n'; fi
install_text zh-CN
