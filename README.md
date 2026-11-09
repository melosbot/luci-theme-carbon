<div align="center">

<img src="htdocs/luci-static/carbon/logo.svg" width="72" height="72" alt="Carbon">

# luci-theme-carbon

A clean, glass-style LuCI theme for OpenWrt — built for everyday users.

**English** · [简体中文](README.zh-CN.md)

[![Build](https://github.com/mrjoechen/luci-theme-carbon/actions/workflows/build.yml/badge.svg)](https://github.com/mrjoechen/luci-theme-carbon/actions/workflows/build.yml)
[![Release](https://img.shields.io/github/v/release/mrjoechen/luci-theme-carbon)](https://github.com/mrjoechen/luci-theme-carbon/releases/latest)
[![License](https://img.shields.io/github/license/mrjoechen/luci-theme-carbon)](LICENSE)


**[Live demo](https://mrjoechen.github.io/luci-theme-carbon/) · [English demo](https://mrjoechen.github.io/luci-theme-carbon/?lang=en)**

</div>

## Screenshots


<p align="center"><img src=".github/screenshots/overview-light.jpg" alt="Light" width="100%"></p>

<p align="center"><img src=".github/screenshots/overview-dark.jpg" alt="Dark" width="100%"></p>

## Features

- **Dashboard** on *Status → Overview*: live traffic chart, CPU / memory / storage rings, memory breakdown, load sparkline, connection count, uptime, connected devices and interface status. LuCI's original status widgets are kept behind *Show detailed status*.
- **Device brand icons** — connected devices are recognised by hostname and MAC vendor prefix (35 brands, ~9,200 IEEE OUI prefixes).
- **Simple / Pro navigation** — *Simple* shows only the pages most people need (overview, internet, Wi‑Fi, software, password, backup, reboot); *Pro* shows the full LuCI menu with an icon for every page.
- **Frosted-glass sidebar** that collapses into an icon rail (button on the sidebar edge or <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>\\</kbd>); hovering a rail icon opens its sub-menu.
- **Light / dark / auto** theme switch (top-right) and **中文 / English** language switch (bottom-left).
- **Mobile friendly** — drawer navigation and tables that reflow into cards.
- **Online updates** — check and install stable releases from *System → Carbon Theme Settings*. APK signatures remain verified; download size and SHA-256 are checked before installation.
- Existing LuCI pages and plugins keep working; the updater only installs the Carbon theme package.
- Architecture independent: one theme package for every router.

## Installation & Usage

### Compatibility

| Firmware | Package manager | Package |
|---|---|---|
| OpenWrt / ImmortalWrt 23.05, 24.10 | opkg | `.ipk` or install script |
| OpenWrt / ImmortalWrt 25.x, snapshot | apk | `.apk` or install script |

Requires the ucode-based LuCI (23.05 or newer).

All files are on the [Releases](https://github.com/mrjoechen/luci-theme-carbon/releases/latest) page.

### Option 1 — install script (any firmware)

Run on the router (SSH):

```bash
wget -O /tmp/carbon-install.sh https://github.com/mrjoechen/luci-theme-carbon/releases/latest/download/carbon-install.sh && sh /tmp/carbon-install.sh
```

If the router has no internet access, download `carbon-install.sh` on your computer and copy it over (`-O` is needed because OpenWrt's SSH server has no SFTP):

```bash
scp -O carbon-install.sh root@192.168.1.1:/tmp/
```

```bash
ssh root@192.168.1.1 "sh /tmp/carbon-install.sh"
```

### Option 2 — opkg (`.ipk`, 23.05 / 24.10)

Upload `luci-theme-carbon_*_all.ipk` in *System → Software → Upload Package*, or:

```bash
opkg install /tmp/luci-theme-carbon_*_all.ipk
```

### Option 3 — apk (`.apk`, 25.x / snapshot)

**v1.0.1 and newer Release APKs are signed.** Import `carbon-apk.pem` once per device, then install or upgrade directly in LuCI:

1. Download the public key and APK from [Releases](https://github.com/mrjoechen/luci-theme-carbon/releases/latest).
2. In Pro mode, open **System → Administration → Repo Public Keys**, paste the full public key and click **Add key** (if your firmware provides this page).
3. Open **System → Software → Upload Package**, upload the APK and install.

Older LuCI needs a one-time SSH key import. See [APK configuration and troubleshooting](docs/apk-install.md) for the verified key fingerprint, commands and preserving the key across firmware upgrades. The old v1.0.0 APK is unsigned; download a new version. Repository `wget` / `packages.adb` errors are separate network/feed problems and still need fixing for reliable web installs.

### After installing

Carbon becomes the default theme. Refresh the page, then **log out and log in once** so the dashboard gets its read-only permissions. Switch themes any time in *System → System → Language and Style*.

### Usage

| What | Where |
|---|---|
| Simple / Pro menu | segmented control at the top of the sidebar |
| Collapse sidebar | round button on the sidebar edge, or <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>\\</kbd> |
| Light / dark / auto | top-right of the toolbar |
| 中文 / English | bottom-left of the sidebar (changes LuCI's language, same as *System → Language*) |
| GitHub project | icon at the top-right of the toolbar |
| Check and install theme updates | System → Carbon Theme Settings (Simple and Pro modes) |
| LuCI's original status page | *Show detailed status* under the dashboard |

### Online upgrades (v1.1.0+)

Install v1.1.0 or newer through the native package manager once. Open **System → Carbon Theme Settings** (**Carbon Update** in v1.1.0), click **Check for updates**, then **Install update** and confirm. The page shows release notes, progress and installation logs; refreshing it resumes monitoring. Theme preferences and router configuration are retained. Same-version installs, downgrades and expired update requests are rejected.

APK updates verify the bundled Carbon public key, then use APK's normal signature verification again during installation. They use already-installed dependencies without fetching firmware indexes. This does not change `/etc/apk/keys`; standard LuCI package uploads still need the one-time key import above. IPK updates use HTTPS plus the release asset's SHA-256 and size checks. Update checks need router access to GitHub and correct system time. See [online update details](docs/online-update.md).

Required packages: `curl`, `ca-bundle`, `flock` (installed as native package dependencies). Script-only installations must first install the native APK/IPK package; the script does not create a package-manager database entry.

### Uninstall

```bash
sh /tmp/carbon-install.sh uninstall
```

or remove the package with `opkg remove luci-theme-carbon` / `apk del luci-theme-carbon`. The previous theme is restored automatically.

## Build from source

**Without the SDK** (produces the install script and an `.ipk`):

```bash
sh scripts/build-installer.sh
```

```bash
sh scripts/build-ipk.sh
```

**With the OpenWrt SDK**: put this directory under `package/` and run `make package/luci-theme-carbon/compile`.

**APK signing**: raw SDK APKs are unsigned. See [signing setup and validation](docs/apk-signing.md) for local signing and the `APK_SIGNING_KEY` Actions secret required for releases.

**Brand data** (`brands.js`) is regenerated with `python3 -I scripts/gen-brands.py`.

## Notices

- Brand glyphs: [Simple Icons](https://simpleicons.org) (CC0 1.0). All trademarks belong to their respective owners.
- MAC vendor prefixes: IEEE Registration Authority MA-L registry.
- Widget behaviour follows the official `luci-theme-bootstrap`.

Licensed under [Apache License 2.0](LICENSE).
