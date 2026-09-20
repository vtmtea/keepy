# Keepy

Keepy 是一个面向 Windows 的 Electron 托盘小工具：按固定间隔执行一次轻微鼠标移动并还原，帮助设备保持活动状态。也可以切换为点击模式，但点击会作用于当前鼠标所在的活动窗口，因此必须显式确认。

> Keepy 只提供模拟输入，不保证 Teams 或其他应用一定改变在线状态。请遵守所在组织的安全策略和软件使用规范。

## 功能

- Windows 系统托盘常驻，关闭窗口后不会退出。
- 默认每 60 秒轻微移动鼠标 2 像素并还原。
- 可配置 10–3600 秒的间隔。
- 移动前后会检查鼠标位置；如果用户在此期间移动了鼠标，Keepy 不会强行还原。
- 可选点击模式，并要求用户确认点击可能影响当前活动窗口。
- 设置保存到 Electron 用户数据目录，应用重启后保持暂停，避免未经确认自动操作。
- 单实例运行，托盘菜单提供开始、暂停、打开控制面板和退出。

## 开发环境

- Node.js 20 或更高版本
- Windows 10/11（真实鼠标驱动和安装包验收需要 Windows）
- Linux/WSL 可以运行类型检查、纯逻辑测试和前端构建，但不能替代 Windows 原生输入验证。

安装依赖：

```bash
npm install
```

启动开发模式：

```bash
npm run dev
```

## 检查与打包

```bash
npm run typecheck
npm test
npm run build
npm run dist
```

`npm run dist` 会先构建应用，再通过 `electron-builder` 生成 Windows x64 NSIS 安装包，产物位于 `release/`。Keepy 通过 Windows 自带的 `user32.dll` 完成鼠标操作，不需要随安装包分发或重编译原生 Node 模块。

## 使用提示

1. 启动 Keepy 后，在控制面板选择间隔和活动方式。
2. 点击“保存设置”，再点击“开始 Keepy”。
3. 关闭窗口会隐藏到托盘；通过托盘菜单可以重新打开或退出。
4. 点击模式可能在 Teams、编辑器或其他当前活动窗口中产生实际点击，请谨慎使用。

## 目录结构

- `src/main`：Electron 主进程、托盘、设置存储、活动调度和鼠标驱动。
- `src/preload`：受限的 `contextBridge` API。
- `src/renderer`：中文控制面板和样式。
- `src/shared`：跨进程共享的设置与状态类型。
- `tests`：不触碰真实鼠标的单元测试。
