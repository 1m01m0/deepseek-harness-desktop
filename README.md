# DeepSeek Harness

English | [中文](README.zh.md)

> **About this fork**: This is a fork of the official [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) that adds **desktop packaging** — wrapping the DeepSeek Harness web UI into macOS / Windows / Linux desktop apps that run with a double-click, no command line required.
>
> - **Download installers**: [Releases page](https://github.com/1m01m0/deepseek-harness-desktop/releases) (macOS zip, Windows exe, Linux AppImage)
> - **Packaging code**: [`native/mac-app`](native/mac-app) (macOS, Swift shell) | [`native/electron`](native/electron) (Windows / Linux, Electron shell)
> - **Automated releases**: the `sync-upstream` workflow merges the upstream repo daily, and `check-npm-updates` checks npm daily for new `@deepseek-ai/dsh` releases, pins the new version, rebuilds and publishes installers for all three platforms automatically

## Installation

Download the installer for your platform from the [Releases page](https://github.com/1m01m0/deepseek-harness-desktop/releases). Artifacts are named `DeepSeek-Harness-<version>-<platform>-<arch>[-<variant>]`, e.g. `DeepSeek-Harness-0.1.2-macos-arm64.zip`.

### macOS

1. Download `DeepSeek-Harness-*-macos-arm64.zip` (Apple Silicon)
2. Unzip and drag `DeepSeek Harness.app` into the Applications folder
3. If Gatekeeper blocks the first launch, right-click the app → Open, or run:

   ```sh
   xattr -dr com.apple.quarantine "/Applications/DeepSeek Harness.app"
   ```

### Windows

1. Download the installer `DeepSeek-Harness-*-windows-x64-setup.exe` (installs) or the portable `DeepSeek-Harness-*-windows-x64-portable.exe` (no install)
2. Installer: double-click and follow the prompts; portable: just double-click to run
3. If SmartScreen warns on first launch, click "More info" → "Run anyway"

### Linux

1. Download `DeepSeek-Harness-*-linux-x64.AppImage`
2. Make it executable:

   ```sh
   chmod +x DeepSeek-Harness-*.AppImage
   ```

3. Run it:

   ```sh
   ./DeepSeek-Harness-*.AppImage
   ```

Configure your model API key in the app on first launch.

## Automated releases

The release pipeline is fully automated and runs daily with no manual steps:

1. **Sync upstream source**: the `sync-upstream` workflow merges the official [deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) master into this repo daily at 08:00 UTC. On a merge conflict the run fails and notifies you on GitHub; master stays untouched until you resolve it manually and re-run.
2. **Detect new npm releases**: the `check-npm-updates` workflow compares the latest `@deepseek-ai/dsh` version on npm with the version recorded in `native/mac-app/DSH_VERSION` daily at 09:17 UTC.
3. **Package and publish**: when a new version is found, it first writes the version back into `DSH_VERSION` (so the next daily check does not re-trigger the same build), then triggers the macOS / Windows / Linux packaging workflows, which create a `v<dsh-version>` Release, upload the installers, and refresh the macOS Sparkle appcast and the Windows `latest.yml` update feed.
4. **Client updates**: see the next section.

> Pushing a `v0.1.x` tag manually still works for shipping packaging fixes, but never affects update decisions — the app version always equals the packaged dsh runtime version.

## Automatic updates

- **macOS / Windows (installer)**: the app checks for updates automatically at startup and via the “检查更新…” (“Check for Updates…”) menu item; once a new version is downloaded, restart to apply it.
- **Windows portable**: the portable build cannot update itself; download the new installer from the [Releases page](https://github.com/1m01m0/deepseek-harness-desktop/releases).
- **Linux AppImage**: automatic installation is not supported yet; “Check for Updates…” opens the download page when a new release exists.

> **About version numbers**: the app's version is the version of the packaged dsh runtime (e.g. `0.1.0-rc.6`); a Release tag (`v0.1.x`) only identifies a packaging build and never triggers an update by itself. Users of `v0.1.7` or earlier installers need **one manual download** of the latest installer to switch over (their old version number `0.1.7` is higher than the new `0.1.0-rc.x` scheme); automatic updates work normally afterwards.

## Original project

The following is the original project README.

DeepSeek Harness (`dsh`) is an open-source agent harness developed by [DeepSeek AI](https://deepseek.com).

It uses an architecture where **everything is a plugin**, and is powered by [Cordis](https://github.com/cordiverse/cordis), whose design is described in [_A Programming Paradigm for Spatiotemporal Composability_](https://github.com/cordiverse/paper).

## Developer preview

DeepSeek Harness is currently in _developer preview_ and is iterating rapidly. **THERE WILL BE COMPATIBILITY-BREAKING CHANGES.**

## Run

### Run from `npm`

Install `Node.js`, then run:

```sh
npx @deepseek-ai/dsh web
```

The command starts the Web UI, served at `http://127.0.0.1:3080` by default. See [Web UI guide](docs/user/guide/index.md).

### Run from source

To run from a repository checkout:

```sh
git clone https://github.com/deepseek-ai/deepseek-harness.git
cd deepseek-harness
pnpm install
pnpm run build
pnpm dsh web
```

## Community and support

- Feel free to submit feedback or bug reports through [GitHub Discussions](https://github.com/deepseek-ai/deepseek-harness/discussions).
- Add the [`dsh-plugin`](https://github.com/topics/dsh-plugin) topic to your plugin repository for discoverability.
- Join <a href="https://discord.gg/Ycq5dCaS4">DeepSeek Harness Discord community</a>.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Development

Start with the [development guide](docs/development.md) and [architecture documentation](docs/architecture.md).

For agents, follow [AGENTS.md](AGENTS.md).

## License

[MIT](LICENSE)

Third-party dependencies and their licenses are disclosed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
