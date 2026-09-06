# DeepSeek Harness Electron App

English | [中文](README.zh.md)

Package the DeepSeek Harness Web UI as an Electron desktop application for Windows, macOS, and Linux. This is the cross-platform counterpart of the Swift shell in [`native/mac-app`](../mac-app), with:

- The official Node binary (v24 LTS by default).
- The official `@deepseek-ai/dsh` npm runtime (`node_modules`, including the frontend dist).
- An Electron main process that starts `dsh web --port 0 --no-open`, reads its readiness line, and loads the page inside the desktop window without opening an external browser.

Outputs in `native/electron/dist/`:

- Windows: an NSIS installer (`DeepSeek-Harness-<version>-windows-x64-setup.exe`) and portable executable (`DeepSeek-Harness-<version>-windows-x64-portable.exe`).
- macOS: `.dmg` and `.zip`.
- Linux: `.AppImage`.

## Build

```sh
cd native/electron
npm install
node build.js
DSH_TARGET_PLATFORM=win32 node build.js
```

## Configuration

`NODE_MAJOR` defaults to `24`; `DSH_VERSION` defaults to [`native/mac-app/DSH_VERSION`](../mac-app/DSH_VERSION); `DESKTOP_VERSION` defaults to the tag version or [`native/mac-app/DESKTOP_VERSION`](../mac-app/DESKTOP_VERSION). `DSH_TARGET_PLATFORM` selects `win32|darwin|linux`, and `DSH_TARGET_ARCH` selects `x64|arm64`.

Cross-building Windows targets on macOS/Linux usually requires Wine and is unreliable. Build Windows installers on Windows, as the CI workflows do.

## Development

Each platform has a CI workflow that builds on its matching runner when a `v*` tag is pushed and attaches installers to the Release:

- [`.github/workflows/build-windows-app.yml`](../../.github/workflows/build-windows-app.yml) — Windows (NSIS and portable).
- [`.github/workflows/build-linux-app.yml`](../../.github/workflows/build-linux-app.yml) — Linux (AppImage).
- [`.github/workflows/build-macos-app.yml`](../../.github/workflows/build-macos-app.yml) — macOS (zip).

The scheduled `check-npm-updates` workflow triggers all three when it detects a new version.

Desktop installers use an independent, monotonically increasing `DESKTOP_VERSION`; `DSH_VERSION` selects the bundled runtime only. Every new desktop installer release therefore has a higher update version. The installed Windows app uses `electron-updater` to download updates and install them on restart.

## Behavior

As with the macOS shell:

- The server starts and stops with the app. `--port 0` lets the operating system allocate a port; `--no-open` prevents an extra system-browser window. The stdout readiness line is `dsh web: http://127.0.0.1:<port>`.
- Data lives in `%APPDATA%\DeepSeek Harness\dsh` (Windows), `~/Library/Application Support/DeepSeek Harness/dsh` (macOS), or `~/.config/DeepSeek Harness/dsh` (Linux), separately from the terminal version.
- Exit sends SIGTERM to the server: graceful shutdown on POSIX, process termination on Windows.

## Limitations and verification

- All three platforms use `build/icon.png`; electron-builder generates the target platform's icon resources instead of using the default Electron/Tauri icon.
- Installers are unsigned. First launch on Windows may trigger SmartScreen.
