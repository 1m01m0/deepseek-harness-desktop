# DeepSeek Harness macOS App

[English](README.md) | 中文

把 DeepSeek Harness 的 Web UI 打包成一个自包含的 macOS `.app`：

- 内置官方 Node 二进制（默认 v24 LTS，arm64/x64）
- 内置官方 `@deepseek-ai/dsh` npm 运行时（`node_modules`，含前端 dist）
- AppKit + WKWebView 壳，启动 `dsh web --port 0 --no-open` 并加载页面

产物：`dist/DeepSeek Harness.app`（ad-hoc 签名，适合本机使用）。

## 构建

```sh
bash native/mac-app/build.sh
```

完成后启动：

```sh
open "dist/DeepSeek Harness.app"
```

## 配置

| 环境变量 | 默认 | 说明 |
|---|---|---|
| `NODE_MAJOR` | `24` | 内置 Node 大版本（LTS） |
| `DSH_VERSION` | `native/mac-app/DSH_VERSION` 文件 | 打包的 `@deepseek-ai/dsh` npm 版本（环境变量可覆盖） |
| `DESKTOP_VERSION` | tag 版本或 `native/mac-app/DESKTOP_VERSION` 文件 | App/Sparkle 使用的桌面安装包版本，每次发布新包必须递增 |
| `ICON_SRC` | `native/mac-app/app-icon.svg` | App 图标 SVG 源文件（当前为红色 DeepSeek logo，并带透明边距与圆角底板；可用环境变量覆盖） |

例如 `DSH_VERSION=0.1.0-rc.5 bash native/mac-app/build.sh`。

图标源优先使用 `native/mac-app/app-icon.svg`，缺失时回退到 `apps/web/public/favicon.svg`。默认源已经包含透明边距，因此不会再被构建脚本压成满版方形图标。

## 行为

- 服务器进程随 App 启动/退出；启动参数为 `dsh web --port 0 --no-open`，因此页面只在桌面端内置窗口加载，不会额外打开系统浏览器。就绪信号为 stdout 中的 `dsh web: http://127.0.0.1:<port>`，端口由 `--port 0` 交给系统分配，避免与已有服务冲突。
- 数据目录：`~/Library/Application Support/DeepSeek Harness/dsh`（即 `DSH_HOME`），与终端版 `~/.dsh` 隔离；`DSH_TELEMETRY_DISABLED=1`。
- 首次启动在该目录写入 profiles/settings/storages；模型 API 密钥在 App 内配置。
- 外部链接（非 `127.0.0.1`/`localhost` 的 http/https）用系统默认浏览器打开。

## 开发

[`.github/workflows/build-macos-app.yml`](../../.github/workflows/build-macos-app.yml) 在推送 `v*` tag 时于 macOS runner 上构建，并将 `DeepSeek-Harness-<version>-macos-arm64.zip` 附加到 Release。不带版本参数的 `workflow_dispatch` 仅构建并上传 artifact；传入 `desktop_version` 或 `dsh_version` 时还会发布 Release。

[`.github/workflows/check-npm-updates.yml`](../../.github/workflows/check-npm-updates.yml) 每天检查一次 `@deepseek-ai/dsh` 在 npm 的最新版本，若高于 `DSH_VERSION` 文件里记录的版本，就递增 `DESKTOP_VERSION` 并自动触发 `build-macos-app`，生成新的 `v<桌面版本>` Release 安装包。只要桌面版本提高，Sparkle 就会提供更新，即使 dsh 运行时未变化。

## 限制与验证

- 构建脚本第 3 步会先用打包进去的 Node + npm 运行时真启动一次 `dsh web --no-open` 并请求首页做预校验，通过后才组装 App。
- 若官方 npm 运行时的 web 启动失败，可改用本地仓库构建产物作为运行时（用 `scripts/release/pack.ts` 产出的 tarball + `file:` 依赖组装 node_modules）。
- App 为 **ad-hoc 签名**，本机可直接运行；从 GitHub 下载的 zip 会被 Gatekeeper 拦，需右键 → 打开，或 `xattr -dr com.apple.quarantine <app>`。对外分发建议加 Developer ID 签名 + notarization。
