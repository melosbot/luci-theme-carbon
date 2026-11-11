#!/bin/sh
#
# Build, sign and check Carbon's opkg / apk feed from the latest GitHub release
# (CI: .github/workflows/pages.yml). Needs Docker and the GitHub CLI.
#
#   sh scripts/publish-feed.sh OUT_DIR
#
# Environment: GITHUB_REPOSITORY (owner/name), GH_TOKEN, and the signing keys
#   FEED_USIGN_KEY   usign secret key for opkg/Packages.sig (scripts/usign.py keygen)
#   APK_SIGNING_KEY  the APK release key (keys/carbon-apk.pem is its public half)
# Without both keys, or without a release, the feed is skipped with a warning
# so the demo still deploys.
#
# Every container runs without network. Before publishing, the feed is used
# the way a router would: opkg-key + opkg update on OpenWrt 24.10, and the APK
# key + apk update on OpenWrt 25.12, which both verify the index signatures.
#
set -eu

ROOT=$(cd "$(dirname "$0")/.." && pwd)
OUT=${1:?usage: sh scripts/publish-feed.sh OUT_DIR}
REPO=${GITHUB_REPOSITORY:-mrjoechen/luci-theme-carbon}
OPENWRT_OPKG='openwrt/rootfs:x86_64-24.10.8@sha256:9972a4b4747cd136abd597475d7b88c51a49fd849d0d53f069a2f4bf446061b9'
OPENWRT_APK='openwrt/rootfs:x86_64-25.12.6@sha256:14401c04218c2e0da0448f099710ada2460636a92395f353351cc616cf3f67af'
ALPINE='alpine:3.23@sha256:469c9ea410b9215eaee7976ba6c0639039b444be8e5d638f7abbada189971eb2'

warn() { printf '::warning::%s\n' "$*"; }

if [ -z "${FEED_USIGN_KEY:-}" ] || [ -z "${APK_SIGNING_KEY:-}" ]; then
	warn "FEED_USIGN_KEY or APK_SIGNING_KEY is not configured; the package feed is not published"
	exit 0
fi

WORK=$(mktemp -d "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/carbon-feed.XXXXXX")
trap 'rm -rf "$WORK"' EXIT INT TERM
mkdir "$WORK/assets" "$WORK/signing"
(
	umask 077
	printf '%s\n' "$FEED_USIGN_KEY" > "$WORK/signing/feed.sec"
	printf '%s\n' "$APK_SIGNING_KEY" > "$WORK/signing/apk.pem"
)
unset FEED_USIGN_KEY APK_SIGNING_KEY
# The containers run as root; only they and this user can read the keys.
chmod 755 "$WORK/signing"

if ! gh release download --repo "$REPO" --dir "$WORK/assets" --pattern 'luci-theme-carbon*'; then
	warn "no release assets found for $REPO; the package feed is not published"
	exit 0
fi
python3 -I "$ROOT/scripts/build-feed.py" "$WORK/assets" "$OUT" --repository "$REPO"
OUT=$(cd "$OUT" && pwd)
VERSION=$(sed -n 's/^Version: //p' "$OUT/opkg/Packages")

# opkg: sign Packages with usign, then install the key and update like a router.
docker run --rm --network none \
	--mount "type=bind,source=$OUT,target=/feed" \
	--mount "type=bind,source=$WORK/signing,target=/signing,readonly" \
	"$OPENWRT_OPKG" sh -euc '
		usign -S -m /feed/opkg/Packages -s /signing/feed.sec -x /feed/opkg/Packages.sig
		chmod 644 /feed/opkg/Packages.sig
		usign -V -m /feed/opkg/Packages -p /feed/carbon-feed.pub -x /feed/opkg/Packages.sig
		grep -q "^option check_signature" /etc/opkg.conf
		opkg-key add /feed/carbon-feed.pub
		: > /etc/opkg/distfeeds.conf
		echo "src/gz carbon file:///feed/opkg" > /etc/opkg/customfeeds.conf
		opkg update
		opkg info luci-theme-carbon | grep -qx "Version: $1"
		cd /tmp && opkg download luci-theme-carbon && ls luci-theme-carbon_*_all.ipk
		echo "opkg feed OK: $1"
	' sh "$VERSION"

# apk: signed index with apk-tools 3 (the same image that signs the release APK).
mkdir "$WORK/keys"
cp "$ROOT/keys/carbon-apk.pem" "$WORK/keys/carbon-apk.pem"
docker run --rm --network none \
	--mount "type=bind,source=$OUT,target=/feed" \
	--mount "type=bind,source=$WORK/keys,target=/keys,readonly" \
	--mount "type=bind,source=$WORK/signing,target=/signing,readonly" \
	"$ALPINE" sh -euc '
		cd /feed/apk
		apk --keys-dir /keys --repositories-file /dev/null --no-network verify ./*.apk
		apk mkndx --keys-dir /keys --sign-key /signing/apk.pem --output packages.adb ./*.apk
		chmod 644 packages.adb
	'

# apk on OpenWrt: an untrusted index must fail, the trusted one must list the package.
docker run --rm --network none \
	--mount "type=bind,source=$OUT,target=/feed,readonly" \
	"$OPENWRT_APK" sh -euc '
		: > /etc/apk/repositories.d/distfeeds.list
		echo /feed/apk/packages.adb > /etc/apk/repositories.d/customfeeds.list
		if apk update >/tmp/untrusted.log 2>&1; then echo "index accepted without the Carbon key" >&2; exit 1; fi
		cp /feed/carbon-apk.pem /etc/apk/keys/carbon-apk.pem
		apk update
		apk search -e luci-theme-carbon | grep -q "^luci-theme-carbon-$1"
		apk fetch --output /tmp luci-theme-carbon && ls /tmp/luci-theme-carbon-*.apk
		echo "apk feed OK: $1"
	' sh "$VERSION"

echo "Package feed for luci-theme-carbon $VERSION is in $OUT"
