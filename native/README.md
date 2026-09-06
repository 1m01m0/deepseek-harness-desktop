# Native components

English | [中文](README.zh.md)

Native source and public packages maintained with DeepSeek Harness. The [`landlock-run/` workspace](landlock-run/README.md) owns the Landlock self-restrict-then-exec launcher consumed by the harness, including its architecture, three-package npm family, platform support, development workflow, and [release procedure](landlock-run/docs/release.md).

## Desktop applications

[`mac-app`](mac-app/README.md) packages the Web UI as a macOS AppKit application. [`electron`](electron/README.md) provides the cross-platform shell used for Windows and Linux releases. Each directory documents its build commands, configuration, application data location, and release limitations. Download installers from the [desktop releases](https://github.com/1m01m0/deepseek-harness-desktop/releases).

## Workspace and release boundary

`landlock-run/` and its packages belong to the repository's root pnpm workspace and lockfile. Harness consumers use the current workspace entry package during development and CI, so a launcher contract change and its consumer update can land and be tested together.

The main repository's `Landlock Run` workflow builds and tests each supported architecture. `Landlock Run Release` assembles those native artifacts, packs and verifies the three npm tarballs, then optionally publishes them under one launcher version. The entry package retains platform packages as npm optional dependencies, so npm still installs only the package matching the user's operating system and CPU.
