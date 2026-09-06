# DeepSeek Harness macOS App

English | [中文](README.zh.md)

Package the DeepSeek Harness Web UI as a self-contained macOS `.app` with:

- The official Node binary (v24 LTS by default, arm64/x64).
- The official `@deepseek-ai/dsh` npm runtime (`node_modules`, including the frontend dist).
- An AppKit + WKWebView shell that launches `dsh web --port 0 --no-open` and loads the page.

The output is `dist/DeepSeek Harness.app`, with ad-hoc signing for local use.

## Build

```sh
bash native/mac-app/build.sh
```

Launch the completed app:

```sh
open "dist/DeepSeek Harness.app"
```

## Configuration

| Environment variable | Default | Purpose |
|---|---|---|
| `NODE_MAJOR` | `24` | Bundled Node major version (LTS) |
| `DSH_VERSION` | `native/mac-app/DSH_VERSION` file | Bundled `@deepseek-ai/dsh` npm version; an environment variable can override it |
| `DESKTOP_VERSION` | Tag version or `native/mac-app/DESKTOP_VERSION` file | Desktop installer version used by the app and Sparkle; increment for every release |
| `ICON_SRC` | `native/mac-app/app-icon.svg` | App icon SVG: a red DeepSeek logo with transparent padding and rounded backing; an environment variable can override it |

For example: `DSH_VERSION=0.1.0-rc.5 bash native/mac-app/build.sh`.

The icon source defaults to `native/mac-app/app-icon.svg`, falling back to `apps/web/public/favicon.svg` if absent. The default source includes transparent padding, which the build preserves instead of filling the entire square.

## Behavior

- The server starts and stops with the app. `dsh web --port 0 --no-open` loads the page in the desktop window without opening the system browser. Readiness is the stdout line `dsh web: http://127.0.0.1:<port>`; `--port 0` lets the operating system choose a free port.
- Data lives in `~/Library/Application Support/DeepSeek Harness/dsh` (`DSH_HOME`), separately from the terminal's `~/.dsh`; `DSH_TELEMETRY_DISABLED=1`.
- First launch writes profiles/settings/storages to that directory. Configure model API keys in the app.
- External HTTP/HTTPS links whose host is neither `127.0.0.1` nor `localhost` open in the system browser.

## Development

[`.github/workflows/build-macos-app.yml`](../../.github/workflows/build-macos-app.yml) builds on a macOS runner when a `v*` tag is pushed and attaches `DeepSeek-Harness-<version>-macos-arm64.zip` to the Release. A `workflow_dispatch` without version inputs builds and uploads an artifact only; supplying `desktop_version` or `dsh_version` also publishes a Release.

[`.github/workflows/check-npm-updates.yml`](../../.github/workflows/check-npm-updates.yml) checks the latest npm `@deepseek-ai/dsh` version daily. When it exceeds the recorded `DSH_VERSION`, the workflow increments `DESKTOP_VERSION` and triggers `build-macos-app` to publish a `v<desktop-version>` installer. Sparkle offers an update whenever the desktop version increases, including when the bundled dsh runtime is unchanged.

## Limitations and verification

- Before assembling the app, build step 3 launches `dsh web --no-open` with the bundled Node and npm runtime and requests its home page as a preflight check.
- If the official npm runtime cannot start its Web UI, a local repository build can supply the runtime: assemble `node_modules` with a tarball from `scripts/release/pack.ts` and a `file:` dependency.
- The app uses ad-hoc signing for local use. GitHub-downloaded zip files can trigger Gatekeeper; use right-click → Open, or `xattr -dr com.apple.quarantine <app>`. Public distribution should use Developer ID signing and notarization.
