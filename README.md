# DeepSeek Harness Desktop

English | [中文](README.zh.md)

DeepSeek Harness Desktop packages the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web UI as desktop applications for macOS, Windows, and Linux. Download an installer, launch the app, and configure your model API key without using a terminal.

The upstream agent harness (`dsh`) is developed by [DeepSeek AI](https://deepseek.com). Its everything-is-a-plugin architecture is powered by [Cordis](https://github.com/cordiverse/cordis); see [_A Programming Paradigm for Spatiotemporal Composability_](https://github.com/cordiverse/paper).

## Developer preview

DeepSeek Harness is in _developer preview_ and is iterating rapidly. **THERE WILL BE COMPATIBILITY-BREAKING CHANGES.**

## Run

### Install the desktop app

Download the installer for your platform from the [Releases page](https://github.com/1m01m0/deepseek-harness-desktop/releases). Artifacts are named `DeepSeek-Harness-<version>-<platform>-<arch>[-<variant>]`, e.g. `DeepSeek-Harness-0.1.2-macos-arm64.zip`.

#### macOS

1. Download `DeepSeek-Harness-*-macos-arm64.zip` (Apple Silicon)
2. Unzip and drag `DeepSeek Harness.app` into the Applications folder
3. If Gatekeeper blocks the first launch, right-click the app → Open, or run:

   ```sh
   xattr -dr com.apple.quarantine "/Applications/DeepSeek Harness.app"
   ```

#### Windows

1. Download the installer `DeepSeek-Harness-*-windows-x64-setup.exe` (installs) or the portable `DeepSeek-Harness-*-windows-x64-portable.exe` (no install)
2. Installer: double-click and follow the prompts; portable: just double-click to run
3. If SmartScreen warns on first launch, click "More info" → "Run anyway"

#### Linux

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

### Run from `npm`

Install `Node.js`, then run:

```sh
npx @deepseek-ai/dsh web
```

The command starts the Web UI at `http://127.0.0.1:3080` by default and opens it in the default browser for a local launch. An SSH launch only prints the host URL because the SSH client or editor owns the local forwarded address. Pass `--no-open` to run the server without opening a browser. See [Web UI guide](docs/user/guide/index.md).

### Run from source

To run from a repository checkout:

```sh
git clone https://github.com/1m01m0/deepseek-harness-desktop.git
cd deepseek-harness-desktop
pnpm install
pnpm run build
pnpm dsh web
```

`pnpm run build` prepares the repository artifacts. `pnpm dsh web` uses those built artifacts without rebuilding.

## Automatic updates

- **macOS / Windows (installer)**: the app checks for updates automatically at startup and via the “检查更新…” (“Check for Updates…”) menu item; once a new version is downloaded, restart to apply it.
- **Windows portable**: the portable build cannot update itself; download the new installer from the [Releases page](https://github.com/1m01m0/deepseek-harness-desktop/releases).
- **Linux AppImage**: automatic installation is not supported yet; “Check for Updates…” opens the download page when a new release exists.

The app uses an independent, monotonically increasing desktop version (`DESKTOP_VERSION`), while the bundled dsh runtime stays pinned by `DSH_VERSION`. Every installer release with a higher desktop version is therefore updateable even when the dsh runtime is unchanged.

## Community and support

- Submit feedback or bug reports through [GitHub Discussions](https://github.com/deepseek-ai/deepseek-harness/discussions).
- Add the [`dsh-plugin`](https://github.com/topics/dsh-plugin) topic to your plugin repository for discoverability.
- Join <a href="https://discord.gg/Ycq5dCaS4">DeepSeek Harness Discord community</a>.

Join the upstream WeCom community using the assistant and survey below; the official WeChat account is also linked.

<table>
  <thead>
    <tr>
      <th align="center">企微小助手</th>
      <th align="center">入群问卷</th>
      <th align="center">微信公众号</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td align="center"><img src="https://cdn.deepseek.com/harness/readme/community-wecom-assistant.png" alt="DeepSeek Harness 企微小助手二维码" width="180" height="180"></td>
      <td align="center"><a href="https://trtgsjkv6r.feishu.cn/share/base/form/shrcnIt5twSVdLGD52KJBckGCgg"><img src="https://cdn.deepseek.com/harness/readme/community-wecom-survey.png" alt="DeepSeek Harness 入群问卷二维码" width="180" height="180"></a></td>
      <td align="center"><img src="https://cdn.deepseek.com/harness/readme/community-wechat-official-account.png" alt="DeepSeek Harness 团队微信公众号二维码" width="180" height="180"></td>
    </tr>
  </tbody>
</table>

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Development

Desktop packaging is maintained in [`native/mac-app`](native/mac-app/README.md) (macOS, AppKit and WKWebView) and [`native/electron`](native/electron/README.md) (Electron; used for Windows and Linux releases).

Start with the [development guide](docs/development.md) and [architecture documentation](docs/architecture.md).

For documentation changes, follow [docs/AGENTS.md](docs/AGENTS.md).

### Automated releases

The scheduled workflows synchronize upstream source and publish desktop installers:

1. **Sync upstream source**: the `sync-upstream` workflow merges the official [deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) master into this repo daily at 08:00 UTC. On a merge conflict the run fails and notifies you on GitHub; master stays untouched until you resolve it manually and re-run.
2. **Detect new npm releases**: the `check-npm-updates` workflow compares the latest `@deepseek-ai/dsh` version on npm with the version recorded in `native/mac-app/DSH_VERSION` daily at 09:17 UTC.
3. **Package and publish**: when a new version is found, it updates `DSH_VERSION`, increments the independent `DESKTOP_VERSION`, then triggers the macOS / Windows / Linux packaging workflows. They create a `v<desktop-version>` Release, upload the installers, and refresh the macOS Sparkle appcast and Windows `latest.yml` feed.
4. **Client updates**: see [Automatic updates](#automatic-updates).

Pushing a `v*` tag manually publishes a packaging fix; the tag version becomes the desktop app version, so clients update even when the bundled dsh runtime is unchanged.

## License

[MIT](LICENSE)

Third-party dependencies and their licenses are disclosed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
