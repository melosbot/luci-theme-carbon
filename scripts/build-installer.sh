#!/bin/sh
#
# Build dist/carbon-install.sh — a single self-extracting installer that
# works on opkg and apk based OpenWrt / ImmortalWrt (LuCI 23.05+).
#
# Usage: sh scripts/build-installer.sh [output-dir]
#
set -eu

ROOT=$(cd "$(dirname "$0")/.." && pwd)
OUT=${1:-"$ROOT/dist"}
VER=$(sed -n 's/^PKG_VERSION:=//p' "$ROOT/Makefile")
TARGET="$OUT/carbon-install.sh"

WORK=$(mktemp -d "${TMPDIR:-/tmp}/carbon-inst.XXXXXX")
cleanup() { [ -n "$WORK" ] && [ -d "$WORK" ] && rm -r "$WORK"; }
trap cleanup EXIT INT TERM

DATA="$WORK/data"
mkdir -p "$DATA/www" "$DATA/usr/share/ucode/luci" "$DATA/usr/share/rpcd" "$OUT"

cp -R "$ROOT/htdocs/." "$DATA/www/"
cp -R "$ROOT/ucode/." "$DATA/usr/share/ucode/luci/"
cp -R "$ROOT/root/usr/share/rpcd/." "$DATA/usr/share/rpcd/"
find "$DATA" -name '.DS_Store' -exec rm {} +

if tar --version 2>/dev/null | grep -q 'GNU tar'; then
	TAROPTS="--format=ustar --owner=0 --group=0 --numeric-owner"
else
	export COPYFILE_DISABLE=1
	TAROPTS="--format ustar --uid 0 --gid 0 --uname root --gname root --no-xattrs --no-mac-metadata"
fi

# shellcheck disable=SC2086
(cd "$DATA" && tar $TAROPTS -czf "$WORK/payload.tar.gz" ./www ./usr)

sed "s/@VERSION@/$VER/" "$ROOT/scripts/installer-head.sh" > "$TARGET"
printf '__CARBON_PAYLOAD__\n' >> "$TARGET"
cat "$WORK/payload.tar.gz" >> "$TARGET"
chmod 0755 "$TARGET"

echo "Built $TARGET ($(du -k "$TARGET" | cut -f1) KB)"
