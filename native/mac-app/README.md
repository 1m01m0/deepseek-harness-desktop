# macOS 本地 App 打包（DeepSeek Harness）

把 DeepSeek Harness 的 Web UI 打包成一个自包含的 macOS `.app`：
- 内置官方 **Node** 二进制（默认 v24 LTS，arm64/x64）
- 内置官方 **`@deepseek-ai/dsh`** npm 运行时（`node_modules`，含前端 dist）
- 一个小的 **AppKit + WKWebView** 壳，启动 `dsh web --port 0` 并加载页面

产物：`dist/DeepSeek Harness.app`（ad-hoc 签名，适合本机使用）。

## 构建

```sh
bash native/mac-app/build.sh
```

完成后启动：

```sh
open "dist/DeepSeek Harness.app"
```

## 变量

| 环境变量 | 默认 | 说明 |
|---|---|---|
| `NODE_MAJOR` | `24` | 内置 Node 大版本（LTS） |
| `DSH_VERSION` | `0.1.0-rc.6` | 打包的 `@deepseek-ai/dsh` npm 版本 |
| `ICON_SRC` | `native/mac-app/app-icon.svg` | App 图标 SVG 源文件（可用环境变量覆盖） |

例如 `DSH_VERSION=0.1.0-rc.5 bash native/mac-app/build.sh`。

图标源优先使用 `native/mac-app/app-icon.svg`（当前为 DeepSeek 官方 logo），缺失时回退到 `apps/web/public/favicon.svg`。

## 行为

- 服务器进程随 App 启动/退出；就绪信号为 stdout 中的 `dsh web: http://127.0.0.1:<port>`，端口由 `--port 0` 交给系统分配，避免与已有服务冲突。
- 数据目录：`~/Library/Application Support/DeepSeek Harness/dsh`（即 `DSH_HOME`），与终端版 `~/.dsh` 隔离；`DSH_TELEMETRY_DISABLED=1`。
- 首次启动在该目录写入 profiles/settings/storages；模型 API 密钥在 App 内配置。
- 外部链接（非 `127.0.0.1`/`localhost` 的 http/https）用系统默认浏览器打开。

## 自动构建（GitHub Actions）

仓库内的 [`.github/workflows/build-macos-app.yml`](../../.github/workflows/build-macos-app.yml) 会在 **tag（`v*`）推送**时自动在 macOS runner 上构建并把 `DeepSeek Harness-macos-arm64.zip` 挂到对应 Release；也支持 `workflow_dispatch` 手动触发（仅构建 + 上传 artifact，不发布）。

## 备注

- 构建脚本第 3 步会先用打包进去的 Node + npm 运行时真启动一次 `dsh web` 并请求首页做预校验，通过后才组装 App。
- 若官方 npm 运行时的 web 启动失败，可改用本地仓库构建产物作为运行时（用 `scripts/release/pack.ts` 产出的 tarball + `file:` 依赖组装 node_modules）。
- App 为 **ad-hoc 签名**，本机可直接运行；从 GitHub 下载的 zip 会被 Gatekeeper 拦，需右键 → 打开，或 `xattr -dr com.apple.quarantine <app>`。对外分发建议加 Developer ID 签名 + notarization。
