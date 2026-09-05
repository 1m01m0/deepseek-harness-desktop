# DeepSeek Harness Desktop

English | [中文](README.zh.md)

A desktop distribution of [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) for macOS, Windows, and Linux. Open the app, configure a model, and work with an agent in your local project directory—without installing Node.js or starting a server yourself.

This repository is a community-maintained fork, not an official DeepSeek desktop release. DeepSeek AI develops the underlying `dsh` agent harness; this fork provides desktop shells, runtime packaging, and installer updates.

[Download releases](https://github.com/1m01m0/deepseek-harness-desktop/releases) · [Report a desktop issue](https://github.com/1m01m0/deepseek-harness-desktop/issues) · [User guide](docs/user/guide/index.md)

> **Developer preview:** the underlying harness is evolving rapidly and may introduce breaking changes. The desktop app bundles a runtime, not model weights; using a hosted model requires your own provider credentials and network access.

## What you get

- The DeepSeek Harness Web UI in a desktop window, with workspace selection, persistent sessions, file tools, command execution, and approval controls supplied by the runtime.
- A native AppKit/WKWebView shell on macOS and an Electron shell for Windows and Linux.
- A bundled Node.js runtime and the published `@deepseek-ai/dsh` package, with a local [model-modality compatibility patch](native/patch-dsh-runtime.cjs).
- A local server that starts and stops with the app, uses an automatically assigned loopback port, and keeps desktop configuration separate from the terminal installation.

Available providers, tools, and model capabilities depend on the bundled runtime and your configuration. The upstream architecture is built around Cordis plugins; see the [architecture guide](docs/architecture.md) for extension points.

## Install

Download an asset for your operating system and CPU from this fork's [Releases page](https://github.com/1m01m0/deepseek-harness-desktop/releases). These are the targets configured in the release workflows; consult each release for the assets actually available.

| Platform | Release asset | Update behavior |
|---|---|---|
| macOS, Apple Silicon | `DeepSeek-Harness-<version>-macos-arm64.zip` | Sparkle checks for updates; follow the installation prompt |
| Windows, x64 | `DeepSeek-Harness-<version>-windows-x64-setup.exe` | Downloads updates and installs on restart/exit |
| Windows, x64 portable | `DeepSeek-Harness-<version>-windows-x64-portable.exe` | Download a newer portable build or installer manually |
| Linux, x64 | `DeepSeek-Harness-<version>-linux-x64.AppImage` | Check for Updates directs you to the download page |

### macOS

1. Download and unzip the Apple Silicon asset. The app declares macOS 13.0 or later as its minimum version.
2. Move **DeepSeek Harness.app** into **Applications**, then open it.
3. The current build uses ad-hoc signing and is not notarized. If macOS blocks it, first confirm the download came from this repository; use the system's Open/Open Anyway option when available.

For a trusted download that remains quarantined, the following command removes quarantine from this app only:

```sh
xattr -dr com.apple.quarantine "/Applications/DeepSeek Harness.app"
```

The release workflow builds Apple Silicon packages. The [macOS build script](native/mac-app/build.sh) also selects x64 when run on an Intel Mac; an Intel release asset is not promised.

### Windows

1. Choose **setup.exe** for an installation or **portable.exe** to run without an installer.
2. Run the file and follow the installer prompts, if applicable.
3. The current packages are unsigned. If SmartScreen appears, verify the source before using **More info → Run anyway**.

“Portable” describes the executable: its settings and sessions still use the Windows application-data directory below.

### Linux

Download the AppImage, then run these commands in its directory, replacing `<version>` with the downloaded version:

```sh
chmod +x "DeepSeek-Harness-<version>-linux-x64.AppImage"
./DeepSeek-Harness-<version>-linux-x64.AppImage
```

The packaged Linux target is x64. Other architectures and distribution-specific AppImage requirements are not covered by the release workflow.

## First task

1. Open **Settings → Models**, enter your DeepSeek API key, and save. For other providers or a custom endpoint, follow the [model configuration guide](docs/user/guide/providers.md).
2. Click **Choose workspace**, add a local project directory, and select it. The composer remains unavailable until you select a workspace.
3. Start a session with a small request, such as “Summarize this repository and identify its main packages.”
4. Review proposed edits and command execution. The active permission policy determines which operations require approval.

A working setup displays the selected workspace and model and returns a response in the session. The [Web UI guide](docs/user/guide/index.md) explains the rest of the workflow.

## Data and configuration

The desktop shell sets `DSH_HOME` to its own data directory:

| Platform | Default data directory |
|---|---|
| macOS | `~/Library/Application Support/DeepSeek Harness/dsh` |
| Windows | `%APPDATA%\DeepSeek Harness\dsh` |
| Linux | `~/.config/DeepSeek Harness/dsh` (or the application-data location derived from `XDG_CONFIG_HOME`) |

The terminal runtime defaults to `~/.dsh`, so its existing configuration does not automatically appear in the app. The runtime stores settings, credentials, and session data under its data directory; back it up before migrations or resets. Provider keys are stored in `.credentials.yaml`, with references in settings, as described in the [model configuration guide](docs/user/guide/providers.md).

The shells set `DSH_TELEMETRY_DISABLED=1`. Model requests still go to the provider you configure; this setting does not make a hosted model local or offline. The agent can modify files and run commands under the configured permissions, so select an appropriate workspace and review approvals.

## Updates and troubleshooting

macOS and the Windows installer check for updates at startup. Use **检查更新… / Check for Updates…** to check manually. Windows portable and Linux AppImage require a manual download; update installation is not supported in those builds.

| Symptom | What to check |
|---|---|
| App is blocked on first launch | Confirm the asset's source and architecture, then follow the platform-specific installation notes above |
| Composer is unavailable | Select both a workspace and a configured model |
| Authentication or model error | Check the provider key, endpoint, and selected model using the [provider troubleshooting guide](docs/user/guide/providers.md#troubleshooting) |
| Terminal setup is missing in the app | Desktop and terminal installations use different data directories |
| No automatic update on portable/AppImage | Download a new asset from Releases; these builds cannot install updates themselves |
| App never reaches its main window | Report the OS, CPU, desktop version, runtime version if known, and error text in a [desktop issue](https://github.com/1m01m0/deepseek-harness-desktop/issues); omit API keys and private session content |

## Run

The following options run the Web UI in a browser. They are useful for development or when you do not need a desktop shell.

### Published runtime

With a Node.js version supported by the runtime installed, run:

```sh
npx @deepseek-ai/dsh web
```

This installs/runs the upstream npm package and does not include this fork's desktop shell or packaging patch. The server uses `http://127.0.0.1:3080` by default and opens your browser on a local launch. Pass `--no-open` to suppress that; an SSH launch prints the host URL instead.

<a id="run-from-source"></a>

### This repository from source

Prerequisites: Git 2.26+, Node.js **22.19+ within 22.x or 24+**, and **pnpm 11.7.0**, as declared in [package.json](package.json) and the [development guide](docs/development.md). Node.js 23 is outside the declared engine range.

```sh
git clone https://github.com/1m01m0/deepseek-harness-desktop.git
cd deepseek-harness-desktop
pnpm install
pnpm run build
pnpm dsh web
```

`pnpm run build` prepares the checkout's artifacts; `pnpm dsh web` uses them without rebuilding. To work on the live frontend, follow the [development guide](docs/development.md).

### Build a desktop package

Desktop packaging downloads the pinned npm runtime and applies the compatibility patch. It does **not** package your local TypeScript edits by default.

On macOS, with the Swift compiler/Xcode command-line tools, npm, Python 3, and network access available, run from the repository root:

```sh
bash native/mac-app/build.sh
open "dist/DeepSeek Harness.app"
```

On Windows or Linux, with Node.js/npm and network access available, build on the target operating system:

```sh
cd native/electron
npm install
node build.js
```

Electron artifacts are written to `native/electron/dist/`. Both build scripts start the staged runtime and check its web page before packaging. See the [macOS packaging notes](native/mac-app/README.md) and [Electron packaging notes](native/electron/README.md) for build variables and platform requirements; Windows cross-compilation is not a reliable default.

## Repository and release maintenance

| Location | Purpose |
|---|---|
| [`native/mac-app/`](native/mac-app/) | Swift shell, macOS packaging, and version pins |
| [`native/electron/`](native/electron/) | Electron shell and Windows/Linux packaging |
| [`native/patch-dsh-runtime.cjs`](native/patch-dsh-runtime.cjs) | Compatibility overlay applied to the downloaded runtime |
| [`apps/`](apps/) and [`packages/`](packages/) | Synced harness applications and plugin packages |
| [`docs/`](docs/) | User, architecture, and development documentation |
| [`.github/workflows/`](.github/workflows/) | Upstream synchronization and installer releases |

[`DSH_VERSION`](native/mac-app/DSH_VERSION) pins the bundled npm runtime. [`DESKTOP_VERSION`](native/mac-app/DESKTOP_VERSION) identifies the installer and updater version. Increase the desktop version for a new update, including packaging-only fixes; source synchronization alone does not change the bundled runtime.

The [`sync-upstream`](.github/workflows/sync-upstream.yml) workflow is scheduled daily at 08:00 UTC. It merges upstream `master`, preserves known fork-specific differences, and stops without publishing an unresolved merge when an unexpected conflict occurs.

The [`check-npm-updates`](.github/workflows/check-npm-updates.yml) workflow runs after a successful upstream sync, daily at 09:17 UTC, or manually. It compares the highest published SemVer—including prereleases—with the runtime pin, advances the desktop patch version when a newer runtime exists, and dispatches all three packaging workflows. Those workflows publish release assets and updater metadata. `v*` tags and manual workflow runs are also supported; delivery depends on successful workflow execution.

This README is maintained as an English/Chinese pair. Update both files and confirm their consistency record with:

```sh
pnpm run verify-translation-pairing --write README.md
pnpm run verify-translation-pairing README.md
```

See the [bilingual documentation contract](docs/i18n/README.md) before editing translated documentation.

## Support and upstream community

- Report installation, desktop-window, or updater problems in this fork's [issue tracker](https://github.com/1m01m0/deepseek-harness-desktop/issues).
- Discuss harness behavior and upstream development in [DeepSeek Harness Discussions](https://github.com/deepseek-ai/deepseek-harness/discussions); read the inherited [contribution policy](CONTRIBUTING.md), which currently says upstream is not accepting external pull requests.
- Join the upstream [Discord community](https://discord.gg/Ycq5dCaS4), or use the Chinese community resources below. Add the [`dsh-plugin`](https://github.com/topics/dsh-plugin) topic to your own plugin repository for discovery.

| WeCom assistant | Community questionnaire | Official WeChat account |
|---|---|---|
| <img src="https://cdn.deepseek.com/harness/readme/community-wecom-assistant.png" alt="DeepSeek Harness WeCom assistant QR code" width="180" height="180"> | <a href="https://trtgsjkv6r.feishu.cn/share/base/form/shrcnIt5twSVdLGD52KJBckGCgg"><img src="https://cdn.deepseek.com/harness/readme/community-wecom-survey.png" alt="DeepSeek Harness community questionnaire QR code" width="180" height="180"></a> | <img src="https://cdn.deepseek.com/harness/readme/community-wechat-official-account.png" alt="DeepSeek Harness official WeChat account QR code" width="180" height="180"> |

## License and acknowledgments

[MIT License](LICENSE), with upstream copyright retained. Third-party dependencies and their licenses are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

DeepSeek AI created [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). Its plugin architecture is powered by [Cordis](https://github.com/cordiverse/cordis), whose design is described in [A Programming Paradigm for Spatiotemporal Composability](https://github.com/cordiverse/paper). Desktop packaging in this fork builds on that work; the project name does not imply official desktop distribution or endorsement.
