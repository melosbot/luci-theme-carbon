#!/bin/sh
#
# Carbon theme installer for OpenWrt / ImmortalWrt (LuCI 23.05 and later).
# Works on both opkg and apk based systems; no package manager needed.
#
#   sh carbon-install.sh              install or upgrade
#   sh carbon-install.sh uninstall    remove the theme
#
# The theme files are embedded at the end of this script.
#
set -e

VERSION="@VERSION@"
ROOT="${CARBON_ROOT:-}"          # for testing only; empty = real system
PATHS="
/www/luci-static/carbon
/www/luci-static/resources/menu-carbon.js
/usr/share/ucode/luci/template/themes/carbon
/usr/share/rpcd/acl.d/luci-theme-carbon.json
/usr/share/rpcd/acl.d/luci-theme-carbon-update.json
/usr/share/luci/menu.d/luci-theme-carbon.json
/usr/share/carbon
/usr/libexec/rpcd/luci.carbon_update
/www/luci-static/resources/view/system/carbon-update.js
/www/luci-static/resources/carbon
/etc/config/carbon
"

say() { printf '%s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

have_uci() { [ -z "$ROOT" ] && command -v uci >/dev/null 2>&1; }

refresh_luci() {
	[ -n "$ROOT" ] && return 0
	rm -f /tmp/luci-indexcache* 2>/dev/null || true
	rm -rf /tmp/luci-modulecache 2>/dev/null || true
	[ -x /etc/init.d/rpcd ] && /etc/init.d/rpcd reload >/dev/null 2>&1 || true
}

do_install() {
	if [ -z "$ROOT" ]; then
		[ "$(id -u)" = 0 ] || die "please run as root"
		[ -f /usr/share/ucode/luci/template/header.ut ] || \
			die "LuCI with ucode templates (OpenWrt 23.05 or later) is required"
	fi

	line=$(awk '/^__CARBON_PAYLOAD__$/ { print NR + 1; exit 0 }' "$0")
	[ -n "$line" ] || die "embedded payload not found (file damaged?)"

	say "Installing Carbon theme $VERSION ..."
	mkdir -p "$ROOT/"
	tail -n +"$line" "$0" | tar -xzf - -C "$ROOT/" || die "failed to unpack theme files"

	if have_uci; then
		uci set luci.themes.Carbon=/luci-static/carbon
		uci set luci.main.mediaurlbase=/luci-static/carbon
		uci commit luci
	fi

	refresh_luci
	say ""
	say "Done. Carbon is now the active theme."
	say "Refresh the LuCI page, then log out and back in once so the"
	say "dashboard can read CPU / connection statistics."
}

do_uninstall() {
	say "Removing Carbon theme ..."
	for p in $PATHS; do
		rm -rf "${ROOT}${p}"
	done

	if have_uci; then
		uci -q delete luci.themes.Carbon || true
		if [ "$(uci -q get luci.main.mediaurlbase)" = "/luci-static/carbon" ]; then
			fallback=""
			for t in bootstrap argon material openwrt-2020; do
				if [ -d "/www/luci-static/$t" ]; then fallback="/luci-static/$t"; break; fi
			done
			if [ -n "$fallback" ]; then
				uci set luci.main.mediaurlbase="$fallback"
			else
				uci -q delete luci.main.mediaurlbase || true
			fi
		fi
		uci commit luci
	fi

	refresh_luci
	say "Done. Refresh the LuCI page."
}

case "${1:-install}" in
	install|upgrade) do_install ;;
	uninstall|remove) do_uninstall ;;
	*) say "Usage: sh $0 [install|uninstall]"; exit 1 ;;
esac

exit 0
