# DeepSeek Harness Desktop

[English](README.md) | 中文

DeepSeek Harness Desktop 将 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的 Web UI 打包为 macOS、Windows 和 Linux 桌面应用。下载安装包、启动应用并配置模型 API 密钥即可使用，无需终端。

上游 agent harness（智能体框架）`dsh` 由 [DeepSeek AI](https://deepseek.com) 开发，采用一切皆插件的架构，并由 [Cordis](https://github.com/cordiverse/cordis) 驱动；设计参见 [_A Programming Paradigm for Spatiotemporal Composability_](https://github.com/cordiverse/paper)。

## 开发者预览

DeepSeek Harness 目前处于 _开发者预览_ 阶段，正在快速迭代。**未来将出现破坏兼容性的变更。**

## 运行

### 安装桌面应用

从 [Releases 页面](https://github.com/1m01m0/deepseek-harness-desktop/releases) 下载对应平台的安装包。安装包按 `DeepSeek-Harness-<版本>-<平台>-<架构>[-<类型>]` 命名，例如 `DeepSeek-Harness-0.1.2-macos-arm64.zip`。

#### macOS

1. 下载 `DeepSeek-Harness-*-macos-arm64.zip`（Apple Silicon）
2. 解压，把 `DeepSeek Harness.app` 拖入「应用程序」文件夹
3. 首次打开若被 Gatekeeper 拦截，右键 App →「打开」，或执行：

   ```sh
   xattr -dr com.apple.quarantine "/Applications/DeepSeek Harness.app"
   ```

#### Windows

1. 下载安装器 `DeepSeek-Harness-*-windows-x64-setup.exe`（需安装）或便携版 `DeepSeek-Harness-*-windows-x64-portable.exe`（免安装）
2. 安装器：双击运行，按提示安装；便携版：双击直接运行
3. 首次运行若出现 SmartScreen 提示，点「更多信息」→「仍要运行」

#### Linux

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

### 通过 `npm` 运行

安装 `Node.js`，然后运行：

```sh
npx @deepseek-ai/dsh web
```

该命令默认会在 `http://127.0.0.1:3080` 启动 Web UI，本机启动时还会用默认浏览器打开页面。通过 SSH 启动时只打印宿主机 URL，因为本地转发地址由 SSH 客户端或编辑器持有。传入 `--no-open` 可仅运行服务器而不打开浏览器。详见 [Web UI 指南](docs/user/guide/index.md)。

### 从源码运行

如需从仓库源码运行：

```sh
git clone https://github.com/1m01m0/deepseek-harness-desktop.git
cd deepseek-harness-desktop
pnpm install
pnpm run build
pnpm dsh web
```

`pnpm run build` 会准备仓库产物。`pnpm dsh web` 会直接使用这些已构建产物，不会重新构建。

<a id="automatic-updates"></a>

## 自动更新

- **macOS / Windows（安装版）**：应用内置自动更新。启动时自动检查新版本，也可通过菜单「检查更新…」手动检查；新版下载完成后按提示重启即完成更新。
- **Windows 便携版**：便携版无法自动更新，请从 [Releases 页面](https://github.com/1m01m0/deepseek-harness-desktop/releases) 下载新版安装包。
- **Linux AppImage**：自动安装暂不支持，菜单「检查更新…」会检查新版并打开下载页面。

App 使用独立、单调递增的桌面版本（`DESKTOP_VERSION`）；安装包内的 dsh 运行时版本由 `DSH_VERSION` 单独记录。只要发布了更高桌面版本的新安装包，macOS / Windows 安装版就会收到更新，即使 dsh 运行时没有变化。

## 社区与支持

- 通过 [GitHub Discussions](https://github.com/deepseek-ai/deepseek-harness/discussions) 提交反馈或 bug 报告。
- 为插件仓库添加 [`dsh-plugin`](https://github.com/topics/dsh-plugin) 话题，便于被发现。
- 加入 <a href="https://discord.gg/Ycq5dCaS4">DeepSeek Harness Discord 社区</a>。

通过下方企微小助手与入群问卷加入上游企微群；同时保留官方微信公众号入口。

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

## 参与贡献

参见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 开发

桌面打包代码位于 [`native/mac-app`](native/mac-app/README.md)（macOS，AppKit 与 WKWebView）和 [`native/electron`](native/electron/README.md)（Electron，用于 Windows 与 Linux 发布）。

请先阅读[开发指南](docs/development.md)与[架构文档](docs/architecture.md)。

面向 agent：请遵循 [docs/AGENTS.md](docs/AGENTS.md)。

### 自动发布

定时工作流负责同步上游源码并发布桌面安装包：

1. **同步上游源码**：`sync-upstream` 工作流每天 08:00 UTC 将官方 [deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) 的 master 合并进本仓库；若出现合并冲突，运行会失败并在 GitHub 通知你，master 保持原样，需手动解决后重跑。
2. **检测 npm 新版**：`check-npm-updates` 工作流每天 09:17 UTC 对比 npm 上 `@deepseek-ai/dsh` 的最新版本与 `native/mac-app/DSH_VERSION` 中记录的版本。
3. **自动打包发布**：发现新版后，回写 `DSH_VERSION`，同时递增独立的 `DESKTOP_VERSION`，再触发 macOS / Windows / Linux 三个打包工作流，自动创建 `v<桌面版本>` Release、上传安装包，并更新 macOS 的 Sparkle appcast 与 Windows 的 `latest.yml` 更新源。
4. **客户端更新**：参见[自动更新](#automatic-updates)。

手动推送 `v*` 标签可用于发布打包修复；标签版本就是 App 的桌面版本，因此即使 dsh 运行时未变化，客户端也会收到更新。

## 许可证

[MIT](LICENSE)

第三方依赖及其许可证见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
