<div align="center">

<img src="htdocs/luci-static/carbon/logo.svg" width="72" height="72" alt="Carbon">

# luci-theme-carbon

简洁的毛玻璃风格 OpenWrt LuCI 主题，为每一个人设计。

[English](README.md) · **简体中文**

[![Build](https://github.com/mrjoechen/luci-theme-carbon/actions/workflows/build.yml/badge.svg)](https://github.com/mrjoechen/luci-theme-carbon/actions/workflows/build.yml)
[![Release](https://img.shields.io/github/v/release/mrjoechen/luci-theme-carbon)](https://github.com/mrjoechen/luci-theme-carbon/releases/latest)
[![License](https://img.shields.io/github/license/mrjoechen/luci-theme-carbon)](LICENSE)

**[在线演示](https://mrjoechen.github.io/luci-theme-carbon/) · [English demo](https://mrjoechen.github.io/luci-theme-carbon/?lang=en)**

</div>

## 界面预览

<p align="center"><img src=".github/screenshots/overview-light.jpg" alt="浅色" width="100%"></p>

<p align="center"><img src=".github/screenshots/overview-dark.jpg" alt="深色" width="100%"></p>

## 功能

- **仪表盘**（状态 → 概览）：实时流量图、CPU / 内存 / 存储圆环、内存构成条、负载迷你图、连接数、运行时间、在线设备和网络接口状态。LuCI 原有的状态信息保留在「显示详细状态」里。
- **设备品牌图标**：根据主机名和 MAC 厂商前缀识别已连接设备（35 个品牌，约 9200 条 IEEE OUI 前缀）。
- **简洁 / 专业双模式**：简洁模式只显示常用功能（概览、上网、Wi‑Fi、软件包、密码、备份、重启）；专业模式显示完整 LuCI 菜单，每个页面都有对应图标。
- **毛玻璃侧栏**，可收起为只显示图标的窄栏（点侧栏边缘的圆形按钮，或按 <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>\\</kbd>），鼠标悬停图标弹出子菜单。
- 右上角切换**浅色 / 深色 / 跟随系统**，左下角切换**中文 / English**。
- **适配手机**：侧栏变为抽屉，表格自动变成卡片。
- **不修改 OpenWrt 任何功能**：纯前端包，所有 LuCI 页面和插件照常使用，卸载即恢复。
- 体积小、与架构无关（约 80 KB，所有路由器通用一个包）。

## 兼容性

| 固件 | 包管理器 | 安装包 |
|---|---|---|
| OpenWrt / ImmortalWrt 23.05、24.10 | opkg | `.ipk` 或安装脚本 |
| OpenWrt / ImmortalWrt 25.x、snapshot | apk | `.apk` 或安装脚本 |

需要 ucode 版 LuCI（23.05 及以后）。

## 安装

所有文件都在 [Releases](https://github.com/mrjoechen/luci-theme-carbon/releases/latest) 页面。

### 方式一：安装脚本（所有固件通用，推荐）

在路由器上执行（SSH 登录后）：

```bash
wget -O /tmp/carbon-install.sh https://github.com/mrjoechen/luci-theme-carbon/releases/latest/download/carbon-install.sh && sh /tmp/carbon-install.sh
```

如果路由器不能上网，先在电脑上下载 `carbon-install.sh` 再传过去（`-O` 不能省，OpenWrt 的 SSH 服务没有 SFTP）：

```bash
scp -O carbon-install.sh root@192.168.1.1:/tmp/
```

```bash
ssh root@192.168.1.1 "sh /tmp/carbon-install.sh"
```

### 方式二：opkg（`.ipk`，23.05 / 24.10）

在「系统 → 软件包 → 上传软件包」上传 `luci-theme-carbon_*_all.ipk`，或执行：

```bash
opkg install /tmp/luci-theme-carbon_*_all.ipk
```

### 方式三：apk（`.apk`，25.x / snapshot）

LuCI 网页上传只接受固件官方签名的包，所以请通过 SSH 安装：

```bash
apk add --allow-untrusted /tmp/luci-theme-carbon-*.apk
```

### 安装之后

Carbon 会自动设为默认主题。刷新页面，然后**退出并重新登录一次**，仪表盘才能读取 CPU、连接数等数据。随时可以在「系统 → 系统 → 语言和界面」切换回其他主题。

## 使用

| 功能 | 位置 |
|---|---|
| 简洁 / 专业菜单 | 侧栏顶部的分段按钮 |
| 收起侧栏 | 侧栏边缘的圆形按钮，或 <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>\\</kbd> |
| 浅色 / 深色 / 自动 | 工具栏右上角 |
| 中文 / English | 侧栏左下角（修改的是 LuCI 的界面语言，等同「系统 → 语言」） |
| LuCI 原版状态页 | 仪表盘下方「显示详细状态」 |

## 卸载

```bash
sh /tmp/carbon-install.sh uninstall
```

或使用 `opkg remove luci-theme-carbon` / `apk del luci-theme-carbon`。卸载后会自动切回原来的主题。

## 构建

**不需要 SDK**（生成安装脚本和 `.ipk`）：

```bash
sh scripts/build-installer.sh
```

```bash
sh scripts/build-ipk.sh
```

**使用 OpenWrt SDK**：把本目录放到 SDK 的 `package/` 下，执行 `make package/luci-theme-carbon/compile`。

**发布版本**由 GitHub Actions 自动构建：推送与 `Makefile` 中 `PKG_VERSION` 一致的 `vX.Y.Z` 标签后，会自动构建安装脚本、`.ipk`（OpenWrt 24.10 SDK）和 `.apk`（OpenWrt 25.12 SDK），并发布到 GitHub Releases。

## 演示站与 GitHub Pages

[在线演示](https://mrjoechen.github.io/luci-theme-carbon/)直接使用主题的 CSS、JavaScript 与品牌图标，包含动态模拟仪表盘、网络接口、设备搜索、Wi-Fi 和系统设置、软件包安装、日志、网络诊断、备份与重启模拟，以及登录页。支持浅色 / 深色 / 自动、简洁 / 专业模式及中英文切换。演示设置仅保留在当前浏览器标签页，不保存密码，也不连接真实路由器。

**本地预览**：在仓库根目录执行 `python3 -m http.server 8000`，打开[本地演示](http://localhost:8000/preview/index.html)，加 `?lang=en` 查看英文。原有 `/preview/form.html` 地址会跳转到无线演示。

**构建部署目录**（仅需 Python 3，无 npm 依赖）：

```bash
python3 scripts/build-demo.py
python3 -m http.server 8000 --directory dist/demo
```

打开[构建后的演示](http://localhost:8000/)。构建仅将演示文件和必要的主题资源复制到 `dist/demo/`，相对资源地址和查询参数导航同时兼容项目 Pages 子路径与自定义域名。

**自动部署**：在仓库 **Settings → Pages → Build and deployment → Source** 中选择一次 **GitHub Actions**。提交并推送这些文件到 `main` 后，**Deploy demo to GitHub Pages** 工作流会在演示、主题资源或工作流变化时构建并部署，也支持手动触发；Pull Request 只构建、不发布。使用内置 `GITHUB_TOKEN`，无需额外配置密钥；仓库部署权限和环境规则需允许 `main`。Fork 后地址为 `https://<用户名>.github.io/<仓库名>/`，请相应修改上方演示链接。

参见 [GitHub Pages 工作流官方文档](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。

**品牌数据**（`brands.js`）可用 `python3 -I scripts/gen-brands.py` 重新生成。

## 致谢

- 品牌图标：[Simple Icons](https://simpleicons.org)（CC0 1.0），所有商标归各自所有者。
- MAC 厂商前缀：IEEE Registration Authority MA-L 注册表。
- 组件行为参照官方 `luci-theme-bootstrap`。

## 许可

[Apache License 2.0](LICENSE)
