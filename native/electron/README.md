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

`check-npm-updates` checks npm daily and runs when desktop code is pushed to master. It waits for all three reusable build workflows, then verifies the Release installers and macOS/Windows update manifests; success no longer means only that builds were dispatched. Missing or incomplete releases are retried on the next run. Code changes to already-public installers get a higher desktop version instead of replacing a same-version update.

Desktop installers use an independent, monotonically increasing `DESKTOP_VERSION`; `DSH_VERSION` selects the bundled runtime only. Every new desktop installer release therefore has a higher update version. The installed Windows app uses `electron-updater` to download updates and install them on restart.

## Behavior

As with the macOS shell:

- The server starts and stops with the app. `--port 0` lets the operating system allocate a port; `--no-open` prevents an extra system-browser window. The stdout readiness line is `dsh web: http://127.0.0.1:<port>`.
- Data lives in `%APPDATA%\DeepSeek Harness\dsh` (Windows), `~/Library/Application Support/DeepSeek Harness/dsh` (macOS), or `~/.config/DeepSeek Harness/dsh` (Linux), separately from the terminal version.
- Exit sends SIGTERM to the server: graceful shutdown on POSIX, process termination on Windows.
- Readiness is parsed only after the complete line arrives. Newer DSH `/?token=...` URLs are preserved for the embedded window's cookie exchange, without opening a browser or disabling server authentication.
- Installed Windows builds check at startup and every 15 minutes. Returning to the foreground also checks, subject to the same 15-minute throttle. Updates download in the background and install after a user-confirmed restart or on exit, without forcing an active session to stop.
- Manual checks show progress, the current-version result, or an error. The portable download button opens Releases. Linux and portable builds still require manual installer downloads.
- Retrying a startup timeout waits for the old server to exit before launching its replacement. Spawn errors are shown as recoverable errors.

## Limitations and verification

- `node --test native/tests/*.test.cjs` covers desktop updates, startup, authentication URLs, navigation boundaries, and release planning. Builds also run `native/verify-dsh-runtime.cjs` against the actual npm packages (real Loader and a loopback model endpoint), and `native/validate-web-runtime.cjs` for the complete web authentication exchange. These checks do not replace a real Windows installation/upgrade test.
- All three platforms use `build/icon.png`; electron-builder generates the target platform's icon resources instead of using the default Electron/Tauri icon.
- Installers are unsigned. First launch on Windows may trigger SmartScreen.
