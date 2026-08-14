# DeepSeek Harness

> **关于本仓库（Fork）**：这是官方 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的 fork，在官方项目基础上增加了**桌面应用打包**，把 DeepSeek Harness 的 Web UI 封装成 macOS / Windows / Linux 桌面应用，双击即用、无需命令行。
>
> - **下载安装包**：[Releases 页面](https://github.com/1m01m0/deepseek-harness-desktop/releases)（macOS zip、Windows exe、Linux AppImage）
> - **打包实现**：[`native/mac-app`](native/mac-app)（macOS，Swift 壳）｜[`native/electron`](native/electron)（Windows / Linux，Electron 壳）
> - **自动更新**：`check-npm-updates` 工作流每天检测官方 `@deepseek-ai/dsh` 新版，自动重新打包并发布三平台安装包

## 安装

从 [Releases 页面](https://github.com/1m01m0/deepseek-harness-desktop/releases) 下载对应平台的安装包。安装包按 `DeepSeek-Harness-<版本>-<平台>-<架构>[-<类型>]` 命名，例如 `DeepSeek-Harness-0.1.2-macos-arm64.zip`。

### macOS

1. 下载 `DeepSeek-Harness-*-macos-arm64.zip`（Apple Silicon）
2. 解压，把 `DeepSeek Harness.app` 拖入「应用程序」文件夹
3. 首次打开若被 Gatekeeper 拦截，右键 App →「打开」，或执行：

   ```sh
   xattr -dr com.apple.quarantine "/Applications/DeepSeek Harness.app"
   ```

### Windows

1. 下载安装器 `DeepSeek-Harness-*-windows-x64-setup.exe`（需安装）或便携版 `DeepSeek-Harness-*-windows-x64-portable.exe`（免安装）
2. 安装器：双击运行，按提示安装；便携版：双击直接运行
3. 首次运行若出现 SmartScreen 提示，点「更多信息」→「仍要运行」

### Linux

1. 下载 `DeepSeek-Harness-*-linux-x64.AppImage`
2. 赋予执行权限：

   ```sh
   chmod +x DeepSeek-Harness-*.AppImage
   ```

3. 运行：

   ```sh
   ./DeepSeek-Harness-*.AppImage
   ```

首次启动后，在 App 内配置模型 API 密钥即可使用。

## 原项目

以下为原项目 README 内容。

English | [中文](README.zh.md)

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
