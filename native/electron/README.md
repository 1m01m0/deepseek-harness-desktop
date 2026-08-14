# 跨平台桌面壳（Electron）

用 Electron 把 DeepSeek Harness 的 Web UI 打包成桌面应用，与 [`native/mac-app`](../mac-app) 的 Swift 壳对应，但跨 Windows / macOS / Linux：

- 内置官方 **Node** 二进制（默认 v24 LTS）
- 内置官方 **`@deepseek-ai/dsh`** npm 运行时（`node_modules`，含前端 dist）
- Electron 主进程启动 `dsh web --port 0`，解析就绪行后加载页面

产物（`native/electron/dist/`）：
- Windows：NSIS 安装器（`DeepSeek Harness Setup <ver>.exe`）+ 便携版（`DeepSeek Harness <ver>.exe`）
- macOS：`.dmg` + `.zip`
- Linux：`.AppImage`

## 构建

```sh
cd native/electron
npm install                  # 安装 electron + electron-builder
node build.js                # 构建当前平台
DSH_TARGET_PLATFORM=win32 node build.js   # 显式指定目标平台
```

变量：`NODE_MAJOR`（默认 `24`）、`DSH_VERSION`（默认 [`native/mac-app/DSH_VERSION`](../mac-app/DSH_VERSION)）、`DSH_TARGET_PLATFORM`（`win32|darwin|linux`）、`DSH_TARGET_ARCH`（`x64|arm64`）。

> 在 macOS/Linux 上交叉构建 Windows 目标通常需要 wine 且不可靠；Windows 安装包应在 Windows 上构建（见下面的 CI）。

## 自动构建（GitHub Actions）

三个平台各有独立的 CI 工作流，在 **tag（`v*`）推送**时于对应 runner 上构建并把安装包挂到 Release：

- [`.github/workflows/build-windows-app.yml`](../../.github/workflows/build-windows-app.yml) — Windows（NSIS + portable）
- [`.github/workflows/build-linux-app.yml`](../../.github/workflows/build-linux-app.yml) — Linux（AppImage）
- [`.github/workflows/build-macos-app.yml`](../../.github/workflows/build-macos-app.yml) — macOS（zip）

`check-npm-updates` 定时任务检测到新版本时会同时触发以上三者。

## 行为

与 macOS 壳一致：

- 服务器随 App 启动/退出；端口 `--port 0` 由系统分配；就绪信号为 stdout 的 `dsh web: http://127.0.0.1:<port>`。
- 数据目录：`%APPDATA%\DeepSeek Harness\dsh`（Windows）／`~/Library/Application Support/DeepSeek Harness/dsh`（macOS）／`~/.config/DeepSeek Harness/dsh`（Linux），与终端版隔离。
- 退出时向服务器发 SIGTERM（POSIX 优雅退出；Windows 上为终止进程）。

## 备注

- Windows 构建暂无自定义 `.ico` 图标（使用 Electron 默认图标），后续可加 `build/icon.ico`。
- 安装包未签名；Windows 首次运行可能触发 SmartScreen 提示。
