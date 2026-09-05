# DeepSeek Harness Desktop

[English](README.md) | 中文

面向 macOS、Windows 和 Linux 的 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 桌面发行版。打开应用、配置模型，就能让 agent（智能体）在本地项目目录中工作，无需自行安装 Node.js 或启动服务器。

本仓库是社区维护的 fork，并非 DeepSeek 官方桌面发行版。底层 `dsh` agent harness（智能体框架）由 DeepSeek AI 开发；本仓库提供桌面壳、运行时打包和安装包更新。

[下载发行版](https://github.com/1m01m0/deepseek-harness-desktop/releases) · [报告桌面问题](https://github.com/1m01m0/deepseek-harness-desktop/issues) · [使用指南](docs/user/guide/index.md)

> **开发者预览：**底层 harness 正在快速迭代，可能引入破坏兼容性的变更。桌面应用内置的是运行时，不包含模型权重；使用托管模型需要自己的提供方凭据和网络连接。

## 提供什么

- 在桌面窗口中使用 DeepSeek Harness Web UI，由运行时提供工作区选择、会话持久化、文件工具、命令执行和审批控制。
- macOS 使用原生 AppKit/WKWebView 壳，Windows 和 Linux 使用 Electron 壳。
- 内置 Node.js 运行时和已发布的 `@deepseek-ai/dsh` 包，并应用本地[模型模态兼容补丁](native/patch-dsh-runtime.cjs)。
- 本地服务器随应用启动和退出，使用自动分配的回环地址端口；桌面配置与终端安装相互独立。

可用的提供方、工具和模型能力取决于内置运行时及其配置。上游采用 Cordis 插件架构；扩展点见[架构指南](docs/architecture.md)。

## 安装

从本仓库的 [Releases 页面](https://github.com/1m01m0/deepseek-harness-desktop/releases) 下载符合操作系统和 CPU 架构的文件。以下是发布工作流配置的目标；实际可下载的文件以各个 Release 为准。

| 平台 | 发布文件 | 更新方式 |
|---|---|---|
| macOS，Apple Silicon | `DeepSeek-Harness-<version>-macos-arm64.zip` | Sparkle 检查更新；按安装提示操作 |
| Windows，x64 | `DeepSeek-Harness-<version>-windows-x64-setup.exe` | 下载更新，并在重启或退出时安装 |
| Windows，x64 便携版 | `DeepSeek-Harness-<version>-windows-x64-portable.exe` | 手动下载新版便携包或安装器 |
| Linux，x64 | `DeepSeek-Harness-<version>-linux-x64.AppImage` | 「检查更新」引导至下载页面 |

### macOS

1. 下载并解压 Apple Silicon 安装包。应用声明最低系统版本为 macOS 13.0。
2. 将 **DeepSeek Harness.app** 移入**应用程序**，然后打开。
3. 当前构建使用 ad-hoc 签名，未经过公证。若被 macOS 拦截，请先确认来自本仓库，再使用系统提供的「打开」或「仍要打开」选项。

如果已确认下载来源可信，但应用仍受隔离限制，可用以下命令仅移除此应用的隔离属性：

```sh
xattr -dr com.apple.quarantine "/Applications/DeepSeek Harness.app"
```

发布工作流构建 Apple Silicon 安装包。[macOS 构建脚本](native/mac-app/build.sh) 在 Intel Mac 上运行时也会选择 x64；本项目不承诺提供 Intel 发布文件。

### Windows

1. 选择 **setup.exe** 进行安装，或选择 **portable.exe** 免安装运行。
2. 运行文件；使用安装器时按提示完成安装。
3. 当前安装包未签名。若出现 SmartScreen 提示，确认来源后再选择**更多信息 → 仍要运行**。

「便携版」指可执行文件无需安装；设置和会话仍写入下文的 Windows 应用数据目录。

### Linux

下载 AppImage，在文件所在目录执行以下命令，将 `<version>` 替换为下载文件的版本：

```sh
chmod +x "DeepSeek-Harness-<version>-linux-x64.AppImage"
./DeepSeek-Harness-<version>-linux-x64.AppImage
```

Linux 打包目标为 x64。发布工作流未覆盖其他架构及各发行版特有的 AppImage 运行要求。

## 第一个任务

1. 打开**设置 → 模型**，输入 DeepSeek API 密钥并保存。其他提供方或自定义端点的设置方法见[模型配置指南](docs/user/guide/providers.md)。
2. 点击**选择工作区**，添加并选中一个本地项目目录。选择工作区之前，输入区不可用。
3. 新建会话，先提出一个小任务，例如「总结这个仓库，并指出主要包的作用」。
4. 检查拟执行的文件编辑与命令。哪些操作需要审批，由当前权限策略决定。

配置成功后，界面会显示所选工作区和模型，并在会话中返回响应。后续操作见 [Web UI 指南](docs/user/guide/index.md)。

## 数据与配置

桌面壳将 `DSH_HOME` 设置为独立的数据目录：

| 平台 | 默认数据目录 |
|---|---|
| macOS | `~/Library/Application Support/DeepSeek Harness/dsh` |
| Windows | `%APPDATA%\DeepSeek Harness\dsh` |
| Linux | `~/.config/DeepSeek Harness/dsh`（或由 `XDG_CONFIG_HOME` 决定的应用数据位置） |

终端运行时默认使用 `~/.dsh`，已有配置不会自动出现在桌面应用中。运行时在数据目录下保存设置、凭据和会话数据；迁移或重置前请备份。提供方密钥保存在 `.credentials.yaml` 中，设置文件仅保存凭据引用，详见[模型配置指南](docs/user/guide/providers.md)。

桌面壳设置了 `DSH_TELEMETRY_DISABLED=1`。模型请求仍会发送到你配置的提供方；此设置不会将托管模型变成本地或离线模型。agent 可以按照配置的权限修改文件和运行命令，请选择合适的工作区并检查审批请求。

## 更新与故障排查

macOS 和 Windows 安装版在启动时检查更新，也可以使用菜单 **检查更新… / Check for Updates…** 手动检查。Windows 便携版和 Linux AppImage 需要手动下载新版；这些版本不支持安装更新。

| 现象 | 检查方法 |
|---|---|
| 首次启动被系统拦截 | 确认文件来源及架构，再按上文对应平台的安装说明操作 |
| 输入区不可用 | 同时选择工作区和已配置的模型 |
| 身份验证或模型错误 | 参照[提供方故障排查指南](docs/user/guide/providers.md#troubleshooting)，检查密钥、端点和所选模型 |
| 应用里没有终端配置 | 桌面和终端安装使用不同的数据目录 |
| 便携版或 AppImage 未自动更新 | 从 Releases 下载新文件；这些版本无法自行安装更新 |
| 应用始终无法进入主窗口 | 在[桌面问题](https://github.com/1m01m0/deepseek-harness-desktop/issues)中提供操作系统、CPU、桌面版本、已知的运行时版本和错误文本；不要附带 API 密钥或私人会话内容 |

## 运行

以下方式在浏览器中运行 Web UI，适合开发或无需桌面壳的场景。

### 已发布运行时

安装运行时支持的 Node.js 版本后，执行：

```sh
npx @deepseek-ai/dsh web
```

此命令安装或运行上游 npm 包，不包含本仓库的桌面壳及打包补丁。服务器默认使用 `http://127.0.0.1:3080`，本机启动时自动打开浏览器。传入 `--no-open` 可禁止自动打开；通过 SSH 启动时只打印宿主机 URL。

<a id="run-from-source"></a>

### 从本仓库源码运行

前置要求：Git 2.26+、Node.js **22.x 中的 22.19+ 或 24+**，以及 **pnpm 11.7.0**，依据为 [package.json](package.json) 和[开发指南](docs/development.md)。Node.js 23 不在声明的引擎版本范围内。

```sh
git clone https://github.com/1m01m0/deepseek-harness-desktop.git
cd deepseek-harness-desktop
pnpm install
pnpm run build
pnpm dsh web
```

`pnpm run build` 准备当前仓库的构建产物；`pnpm dsh web` 直接使用产物，不会重新构建。前端实时开发流程见[开发指南](docs/development.md)。

### 构建桌面安装包

桌面打包会下载固定版本的 npm 运行时并应用兼容补丁，默认**不会**把本地 TypeScript 修改打入安装包。

在 macOS 上准备好 Swift 编译器或 Xcode 命令行工具、npm、Python 3 和网络连接后，从仓库根目录执行：

```sh
bash native/mac-app/build.sh
open "dist/DeepSeek Harness.app"
```

在 Windows 或 Linux 上准备好 Node.js/npm 和网络连接后，在目标操作系统上构建：

```sh
cd native/electron
npm install
node build.js
```

Electron 产物写入 `native/electron/dist/`。两种构建脚本都会在打包前启动暂存运行时并检查网页。构建变量及平台要求见 [macOS 打包说明](native/mac-app/README.md)和 [Electron 打包说明](native/electron/README.md)；不建议默认采用 Windows 交叉编译。

## 仓库与发布维护

| 位置 | 用途 |
|---|---|
| [`native/mac-app/`](native/mac-app/) | Swift 壳、macOS 打包及版本固定文件 |
| [`native/electron/`](native/electron/) | Electron 壳及 Windows/Linux 打包 |
| [`native/patch-dsh-runtime.cjs`](native/patch-dsh-runtime.cjs) | 应用于下载运行时的兼容补丁 |
| [`apps/`](apps/) 和 [`packages/`](packages/) | 从上游同步的 harness 应用与插件包 |
| [`docs/`](docs/) | 用户、架构及开发文档 |
| [`.github/workflows/`](.github/workflows/) | 上游同步及安装包发布 |

[`DSH_VERSION`](native/mac-app/DSH_VERSION) 固定内置 npm 运行时版本；[`DESKTOP_VERSION`](native/mac-app/DESKTOP_VERSION) 标识安装包及更新器版本。发布新更新时需要提高桌面版本，包括仅修复打包的情况；单独同步源码不会改变内置运行时。

[`sync-upstream`](.github/workflows/sync-upstream.yml) 工作流计划每天 08:00 UTC 执行。它合并上游 `master` 并保留已知的 fork 特有差异；遇到未预期冲突时停止，不会发布尚未解决的合并。

[`check-npm-updates`](.github/workflows/check-npm-updates.yml) 工作流在上游同步成功后、每天 09:17 UTC 或手动触发时执行。它比较已发布的最高 SemVer（包括预发布版本）与运行时固定版本；发现更高版本时递增桌面补丁版本，并触发三个平台的打包工作流。这些工作流发布安装包及更新器元数据，也支持 `v*` 标签和手动运行；交付取决于工作流成功执行。

本 README 按英文和中文配对维护。修改两侧文件并确认内容一致后，更新一致性记录：

```sh
pnpm run verify-translation-pairing --write README.md
pnpm run verify-translation-pairing README.md
```

编辑翻译文档前，请阅读[双语文档约定](docs/i18n/README.md)。

## 支持与上游社区

- 安装、桌面窗口或更新器问题，请提交到本仓库的 [issue 跟踪器](https://github.com/1m01m0/deepseek-harness-desktop/issues)。
- harness 行为及上游开发问题，请前往 [DeepSeek Harness Discussions](https://github.com/deepseek-ai/deepseek-harness/discussions)；请阅读沿用的[贡献政策](CONTRIBUTING.md)，其中目前说明上游暂不接受外部 PR（Pull Request）。
- 可加入上游 [Discord 社区](https://discord.gg/Ycq5dCaS4)，或使用下方的中文社区入口。为自己的插件仓库添加 [`dsh-plugin`](https://github.com/topics/dsh-plugin) 话题，便于被发现。

| 企微小助手 | 入群问卷 | 微信公众号 |
|---|---|---|
| <img src="https://cdn.deepseek.com/harness/readme/community-wecom-assistant.png" alt="DeepSeek Harness 企微小助手二维码" width="180" height="180"> | <a href="https://trtgsjkv6r.feishu.cn/share/base/form/shrcnIt5twSVdLGD52KJBckGCgg"><img src="https://cdn.deepseek.com/harness/readme/community-wecom-survey.png" alt="DeepSeek Harness 入群问卷二维码" width="180" height="180"></a> | <img src="https://cdn.deepseek.com/harness/readme/community-wechat-official-account.png" alt="DeepSeek Harness 团队微信公众号二维码" width="180" height="180"> |

## 许可证与致谢

采用 [MIT 许可证](LICENSE)，保留上游版权声明。第三方依赖及其许可证列于 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 由 DeepSeek AI 创建，插件架构由 [Cordis](https://github.com/cordiverse/cordis) 驱动，设计见 [A Programming Paradigm for Spatiotemporal Composability](https://github.com/cordiverse/paper)。本 fork 在此基础上提供桌面打包；项目名称不代表官方桌面发行或认可。
