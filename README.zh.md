# DeepSeek Harness

[English](README.md) | 中文

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

## 自动更新

- **macOS / Windows（安装版）**：应用内置自动更新。启动时自动检查新版本，也可通过菜单「检查更新…」手动检查；新版下载完成后按提示重启即完成更新。
- **Windows 便携版**：便携版无法自动更新，请从 [Releases 页面](https://github.com/1m01m0/deepseek-harness-desktop/releases) 下载新版安装包。
- **Linux AppImage**：自动安装暂不支持，菜单「检查更新…」会检查新版并打开下载页面。

## 原项目

以下为原项目 README 内容。

DeepSeek Harness（`dsh`）是由 [DeepSeek AI](https://deepseek.com) 开发的开源 agent harness（智能体框架）。

它采用**一切皆插件**的架构，并由 [Cordis](https://github.com/cordiverse/cordis) 驱动，其设计参见论文 [_A Programming Paradigm for Spatiotemporal Composability_](https://github.com/cordiverse/paper)。

## 开发者预览

DeepSeek Harness 目前处于 _开发者预览_ 阶段，正在快速迭代。**未来将出现破坏兼容性的变更。**

## 运行

### 通过 `npm` 运行

安装 `Node.js`，然后运行：

```sh
npx @deepseek-ai/dsh web
```

该命令会启动 Web UI，默认地址为 `http://127.0.0.1:3080`。详见 [Web UI 指南](docs/user/guide/index.md)。

### 从源码运行

如需从仓库源码运行：

```sh
git clone https://github.com/deepseek-ai/deepseek-harness.git
cd deepseek-harness
pnpm install
pnpm run build
pnpm dsh web
```

## 社区与支持

- 欢迎通过 [GitHub Discussions](https://github.com/deepseek-ai/deepseek-harness/discussions) 提交反馈或 bug 报告。
- 为你的插件仓库添加 [`dsh-plugin`](https://github.com/topics/dsh-plugin) 话题，便于被发现。
- 欢迎加入 DeepSeek Harness 企微群：扫码添加企微小助手并填写入群问卷，完成后小助手会邀请你入群。

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
      <td align="center"><img src="assets/community-wecom-assistant.png" alt="DeepSeek Harness 企微小助手二维码" width="180" height="180"></td>
      <td align="center"><a href="https://trtgsjkv6r.feishu.cn/share/base/form/shrcnIt5twSVdLGD52KJBckGCgg"><img src="assets/community-wecom-survey.png" alt="DeepSeek Harness 入群问卷二维码" width="180" height="180"></a></td>
      <td align="center"><img src="assets/community-wechat-official-account.png" alt="DeepSeek Harness 团队微信公众号二维码" width="180" height="180"></td>
    </tr>
  </tbody>
</table>

## 参与贡献

参见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 开发

请先阅读[开发指南](docs/development.md)与[架构文档](docs/architecture.md)。

面向 agent：请遵循 [AGENTS.md](AGENTS.md)。

## 许可证

[MIT](LICENSE)

第三方依赖及其许可证见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
