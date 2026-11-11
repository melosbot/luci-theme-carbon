### 安装

| 固件 | 包管理器 | 文件 |
|---|---|---|
| OpenWrt / ImmortalWrt 23.05、24.10 | opkg | `luci-theme-carbon_*_all.ipk` |
| OpenWrt / ImmortalWrt 25.x、snapshot | apk | `luci-theme-carbon-*.apk`（已签名） |
| 以上任意固件 | apk 或 opkg | `carbon-install.sh` |

**安装脚本。** 在路由器上执行。脚本通过 apk/opkg 安装已签名的 APK 或 IPK，在线升级可用，无需导入公钥：

```sh
wget -O /tmp/carbon-install.sh https://github.com/@REPOSITORY@/releases/latest/download/carbon-install.sh && sh /tmp/carbon-install.sh
```

加 `--trust-key` 可同时信任 Carbon 公钥（用于在 LuCI 上传软件包），加 `--files` 只复制文件。

**软件源。** 添加一次 Carbon 的签名软件源（在「系统 → Carbon 主题设置」点击「添加软件源」，或按[软件源说明](https://github.com/@REPOSITORY@/blob/main/docs/feed.md)中的命令），之后在「系统 → 软件包」中安装和升级 Carbon。

**在 LuCI 上传（apk）。** 首次在「系统 → 管理权 → 软件源公钥」导入附件 `carbon-apk.pem`，之后在「系统 → 软件包」上传 APK。没有该页面的固件请参考附件 `APK-INSTALL.md`。

**在线升级。** 通过 apk/opkg 安装后，可在「系统 → Carbon 主题设置」检查并安装新版本。APK 保留签名校验；IPK 按本版本公布的 SHA-256 和文件大小校验。

首次安装后请退出并重新登录一次，让仪表盘和设置页的权限生效。
