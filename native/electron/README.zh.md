# DeepSeek Harness Electron App

[English](README.md) | 中文

用 Electron 把 DeepSeek Harness 的 Web UI 打包成桌面应用，与 [`native/mac-app`](../mac-app) 的 Swift 壳对应，但跨 Windows / macOS / Linux：

- 内置官方 Node 二进制（默认 v24 LTS）
- 内置官方 `@deepseek-ai/dsh` npm 运行时（`node_modules`，含前端 dist）
- Electron 主进程启动 `dsh web --port 0 --no-open`，解析就绪行后在桌面窗口内加载页面，不打开外部浏览器

产物（`native/electron/dist/`）：

- Windows：NSIS 安装器（`DeepSeek-Harness-<version>-windows-x64-setup.exe`）+ 便携版（`DeepSeek-Harness-<version>-windows-x64-portable.exe`）
- macOS：`.dmg` + `.zip`
- Linux：`.AppImage`

## 构建

```sh
cd native/electron
npm install
node build.js
DSH_TARGET_PLATFORM=win32 node build.js
```

## 配置

`NODE_MAJOR`（默认 `24`）、`DSH_VERSION`（默认 [`native/mac-app/DSH_VERSION`](../mac-app/DSH_VERSION)）、`DESKTOP_VERSION`（默认 tag 版本或 [`native/mac-app/DESKTOP_VERSION`](../mac-app/DESKTOP_VERSION)）、`DSH_TARGET_PLATFORM`（`win32|darwin|linux`）、`DSH_TARGET_ARCH`（`x64|arm64`）。

在 macOS/Linux 上交叉构建 Windows 目标通常需要 wine 且不可靠；Windows 安装包应在 Windows 上构建（见下面的 CI）。

## 开发

三个平台各有独立的 CI 工作流，在 **tag（`v*`）推送**时于对应 runner 上构建并把安装包挂到 Release：

- [`.github/workflows/build-windows-app.yml`](../../.github/workflows/build-windows-app.yml) — Windows（NSIS + portable）
- [`.github/workflows/build-linux-app.yml`](../../.github/workflows/build-linux-app.yml) — Linux（AppImage）
- [`.github/workflows/build-macos-app.yml`](../../.github/workflows/build-macos-app.yml) — macOS（zip）

`check-npm-updates` 定时任务检测到新版本时会同时触发以上三者。

桌面安装包使用独立、单调递增的 `DESKTOP_VERSION`；`DSH_VERSION` 只选择内置运行时。因此每次发布新的桌面安装包都会生成更高的更新版本，Windows 安装版可由 `electron-updater` 自动下载并在重启时安装。

## 行为

与 macOS 壳一致：

- 服务器随 App 启动/退出；端口 `--port 0` 由系统分配；桌面启动传入 `--no-open`，不会额外打开系统浏览器；就绪信号为 stdout 的 `dsh web: http://127.0.0.1:<port>`。
- 数据目录：`%APPDATA%\DeepSeek Harness\dsh`（Windows）／`~/Library/Application Support/DeepSeek Harness/dsh`（macOS）／`~/.config/DeepSeek Harness/dsh`（Linux），与终端版隔离。
- 退出时向服务器发 SIGTERM（POSIX 优雅退出；Windows 上为终止进程）。

## 限制与验证

- Windows、macOS、Linux 均使用 `build/icon.png` 作为应用图标；electron-builder 会按目标平台生成对应图标资源，不使用 Electron/Tauri 默认图标。
- 安装包未签名；Windows 首次运行可能触发 SmartScreen 提示。
