# Keepy

Keepy 是一个基于 **Rust + Tauri 2.0 + React + TypeScript** 的 Windows 托盘工具：按固定间隔执行一次轻微鼠标移动并还原，帮助设备保持活动状态。也可以切换为点击模式，但点击会作用于当前鼠标所在的活动窗口，因此必须显式确认。

> Keepy 只提供模拟输入，不保证 Teams 或其他应用一定改变在线状态。请遵守所在组织的安全策略和软件使用规范。

## 功能

- Windows 系统托盘常驻，关闭窗口后不会退出。
- 默认每 60 秒轻微移动鼠标 2 像素并还原。
- 可配置 10–3600 秒的间隔。
- 移动前后会检查鼠标位置；如果用户在此期间移动了鼠标，Keepy 不会强行还原。
- 可选点击模式，并要求用户确认点击可能影响当前活动窗口。
- 设置与窗口状态保存到 Tauri 应用数据目录，应用重启后保持暂停，避免未经确认自动操作。
- 首次启动会尝试从旧 Electron 用户数据目录迁移 `settings.json` 和 `window-state.json`。
- 单实例运行，托盘菜单提供开始、暂停、打开控制面板和退出。

## 开发环境

- Node.js 22 或更高版本
- pnpm 10（项目通过 `packageManager` 固定版本）
- Rust stable、Cargo 和 Windows MSVC Build Tools
- Windows 10/11，系统 WebView2 Runtime
- Linux/WSL 可以运行前端类型检查、测试和构建；Rust/Tauri Windows 原生输入和 NSIS 安装包验收需要 Windows。

安装依赖：

```bash
pnpm install
```

启动前端开发模式：

```bash
pnpm run dev
```

启动 Tauri 开发模式：

```bash
pnpm tauri dev
```

## 检查与打包

```bash
pnpm run typecheck
pnpm test
pnpm run build
cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings
pnpm run dist
```

`pnpm run dist` 会先构建 React 前端，再通过 Tauri 2 生成 Windows x64 NSIS 安装包，产物位于 `src-tauri/target/release/bundle/nsis/`。Rust 后端在 Windows 上直接调用 `user32.dll`，通过 `SendInput` 模拟鼠标操作，不需要 PowerShell 或原生 Node 模块。

推送到 GitHub 后，Windows workflow 只会在 `master` 分支发生 push 时运行。workflow 会在 Ubuntu 上执行前端检查和构建，在 Windows runner 上执行 Rust 检查和 Tauri NSIS 打包，并将生成的 `.exe` 同时作为 `keepy-windows` artifact 上传和 GitHub prerelease 附件发布。Release tag 使用版本号和构建编号，例如 `v0.2.0-build.12`。该安装包默认未签名，正式分发前应配置 Windows 代码签名证书。

## 使用提示

1. 启动 Keepy 后，在控制面板选择间隔和活动方式。
2. 点击“保存设置”，再点击“开始 Keepy”。
3. 关闭窗口会隐藏到托盘；通过托盘菜单可以重新打开或退出。
4. 点击模式可能在 Teams、编辑器或其他当前活动窗口中产生实际点击，请谨慎使用。

## 目录结构

- `src-tauri/src`：Rust 应用生命周期、托盘、命令、状态、调度和 Windows 鼠标驱动。
- `src-tauri/capabilities`：Tauri 2 最小权限配置。
- `src`：React 控制面板、Tauri API 适配和共享 TypeScript 类型。
- `tests`：不触碰真实鼠标的前端行为测试。
- `.github/workflows`：前端检查、Rust 检查、Windows 安装包和 prerelease 发布。
