### Install

| Firmware | Package manager | File |
|---|---|---|
| OpenWrt / ImmortalWrt 23.05, 24.10 | opkg | `luci-theme-carbon_*_all.ipk` |
| OpenWrt / ImmortalWrt 25.x, snapshot | apk | `luci-theme-carbon-*.apk` (signed) |
| Any of the above | apk or opkg | `carbon-install.sh` |

**Install script.** Run on the router. It installs the signed APK or the IPK through apk/opkg, so online updates work and no key import is needed:

```sh
wget -O /tmp/carbon-install.sh https://github.com/@REPOSITORY@/releases/latest/download/carbon-install.sh && sh /tmp/carbon-install.sh
```

Add `--trust-key` to also trust Carbon's key for LuCI package uploads, or `--files` to only copy the files.

**Package feed.** Add Carbon's signed feed once (*Add software source* in System → Carbon Theme Settings, or the commands in the [feed guide](https://github.com/@REPOSITORY@/blob/main/docs/feed.md)), then install and upgrade Carbon in System → Software.

**Upload in LuCI (apk).** Import the attached `carbon-apk.pem` once in System → Administration → Repo Public Keys, then upload the APK in System → Software. The attached `APK-INSTALL.md` covers firmware without that page.

**Online updates.** Once installed through apk/opkg, System → Carbon Theme Settings checks and installs new releases. APK signatures stay verified; IPK downloads are checked against this release's SHA-256 and size.

After a first install, log out and back in once so the dashboard and settings permissions take effect.
