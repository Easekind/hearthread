# hearthread

[English](README.md) · 简体中文

Hearthread 是优先本地存储、跨端可用的个人资料库，以沉浸式阅读为起点，逐步汇聚图书、文档与图片。

![书墙上的十二本样书，底部阅读栏显示当前选中的书](docs/verification/library-desktop.png)

![样书的章节阅读页，阅读工具已收起](docs/verification/reader-desktop.png)

## 主要功能

- **统一资料管理**。EPUB 书籍、PDF 和 Markdown 文档可以在同一书库里分类、查找，后续还将支持图片管理。
- **沉浸式阅读**。轻点正文收起工具，按自己的习惯调整字体和行距。下次打开，接着上次读到的地方继续。
- **跨端使用**。面向 macOS、Windows、iOS 和 Android。换设备时，可以通过书库备份一并迁移原文件和阅读位置。
- **高效渲染**。EPUB 按需加载章节，PDF 只绘制当前页。连续翻页时会取消上一页未完成的绘制。

## 本地开发

安装 Bun 1.3.10 和 Node.js 22.23 或更新版本。运行原生应用还需要稳定版 Rust 和对应平台的工具链。macOS 需要 Xcode Command Line Tools，Windows 需要 MSVC C++ 构建工具和 WebView2。[Tauri 各平台环境配置](https://v2.tauri.app/start/prerequisites/)

在仓库根目录安装依赖并启动桌面应用。

```sh
bun install --frozen-lockfile
bun run tauri dev
```

在浏览器中开发时，运行 `bun run dev`，打开 `http://127.0.0.1:1420`。浏览器使用独立的 IndexedDB 书库，原生应用将文件和 SQLite 数据库存放在系统应用数据目录。两者之间可以通过 ZIP 备份迁移书库。

| 构建目标 | 命令 |
| --- | --- |
| macOS 应用 | `bun run tauri build --bundles app` |
| Windows 桌面应用 | `bun run tauri build` |
| Apple Silicon 上的 iOS 模拟器 | `bun run tauri ios build --debug --target aarch64-sim` |
| Android arm64 调试版 APK | `bun run tauri android build --debug --apk --target aarch64` |
