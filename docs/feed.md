# Package feed (opkg / apk)

Carbon publishes a signed package feed on GitHub Pages next to the live demo:

| Package manager | Feed | Key |
|---|---|---|
| apk (OpenWrt / ImmortalWrt 25.x, snapshot) | `https://mrjoechen.github.io/luci-theme-carbon/feed/apk/packages.adb` | [`carbon-apk.pem`](../keys/carbon-apk.pem) (the key that signs the release APKs) |
| opkg (23.05, 24.10) | `src/gz carbon https://mrjoechen.github.io/luci-theme-carbon/feed/opkg` | [`carbon-feed.pub`](../keys/carbon-feed.pub) (usign) |

Once the feed is added, `luci-theme-carbon` shows up in **System → Software** like any other package. New releases appear under *Updates* after *Update lists…*. The feed holds only the latest release. Your firmware's own feeds still provide the dependencies (`luci-base`, `curl`, `ca-bundle`, `flock`).

## Add the feed

**From Carbon:** open **System → Carbon Theme Settings → Software source** and click **Add software source**. Carbon trusts its bundled key and appends one line to `customfeeds.list` (apk) or `customfeeds.conf` (opkg). **Remove software source** deletes only that line.

**Over SSH (apk):**

```sh
wget -O /etc/apk/keys/carbon-apk.pem https://mrjoechen.github.io/luci-theme-carbon/feed/carbon-apk.pem
echo 'https://mrjoechen.github.io/luci-theme-carbon/feed/apk/packages.adb' >> /etc/apk/repositories.d/customfeeds.list
apk update && apk add luci-theme-carbon
```

**Over SSH (opkg):**

```sh
wget -O /tmp/carbon-feed.pub https://mrjoechen.github.io/luci-theme-carbon/feed/carbon-feed.pub && opkg-key add /tmp/carbon-feed.pub
echo 'src/gz carbon https://mrjoechen.github.io/luci-theme-carbon/feed/opkg' >> /etc/opkg/customfeeds.conf
opkg update && opkg install luci-theme-carbon
```

**In LuCI only:** add the key in **System → Administration → Repo Public Keys**, then add the feed line in **System → Software → Configure apk / opkg…** (`customfeeds`), then *Update lists…* and search for `carbon`.

Check the key before trusting it: `sha256sum /etc/apk/keys/carbon-apk.pem` must print `c5187568040b024559e6dddbd752c4661455b0ccfb94a66b013f05eb28ef9a0b` (see [APK installation](apk-install.md)). The opkg key's fingerprint is `3defd89eb82c69d1` (`usign -F -p carbon-feed.pub`), and its SHA-256 is listed in [`keys/SHA256SUMS`](../keys/SHA256SUMS).

The feed and the built-in updater (System → Carbon Theme Settings) install the same signed packages, so you can use either one.

## Maintainers

`.github/workflows/pages.yml` builds the demo and the feed together, because a Pages deployment replaces the whole site. The release job in `build.yml` dispatches it after each release (a release created with `GITHUB_TOKEN` raises no `release` event). Pushes that touch the demo or the feed scripts rebuild it from the latest release too. [`scripts/publish-feed.sh`](../scripts/publish-feed.sh):

1. downloads the latest release's `.ipk` and signed `.apk` (`gh release download`);
2. writes `opkg/Packages(.gz)` the way OpenWrt's `ipkg-make-index.sh` does, plus the keys and a setup page ([`scripts/build-feed.py`](../scripts/build-feed.py));
3. signs `Packages` with `usign` in an OpenWrt 24.10 container, imports the key with `opkg-key` and runs `opkg update` / `opkg download` against the feed;
4. builds a signed `apk/packages.adb` with `apk mkndx` (Alpine, apk-tools 3), then on OpenWrt 25.12 checks that `apk update` rejects the index without the key and lists the package with it.

All containers run without network. If a check fails, nothing is deployed.

Secrets (Settings → Secrets and variables → Actions):

| Secret | Content |
|---|---|
| `APK_SIGNING_KEY` | already required for releases; also signs `packages.adb` |
| `FEED_USIGN_KEY` | usign secret key for `opkg/Packages.sig`; its public half is `keys/carbon-feed.pub` |

Without both secrets, the feed is skipped with a warning and only the demo deploys.

The usign key was created once with `python3 scripts/usign.py keygen .private/carbon-feed.usign.sec keys/carbon-feed.pub "Carbon opkg feed"` (needs the Python `cryptography` package; `usign -G` on OpenWrt works too). Set the secret from the file without printing it:

```sh
gh secret set FEED_USIGN_KEY < .private/carbon-feed.usign.sec
```

Keep an encrypted backup of the secret key outside the repository. Rotating it means publishing a new `carbon-feed.pub` (keep `root/usr/share/carbon/keys/carbon-feed.pub` and `keys/SHA256SUMS` in sync). Routers that trust the old key must import the new one.
