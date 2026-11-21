# hearthread

hearthread 是一款本地优先的中文阅读器，支持 EPUB、PDF 和独立 Markdown 文档。首次打开显示设计稿中的 12 本排版样书。自己的书可以通过选择文件或拖放导入；原文件、分类、阅读位置和偏好会在设备上保留。

## 运行

使用 Bun 1.3.10、Node.js 22.23 或更新版本 和稳定版 Rust。在 macOS 安装 Xcode Command Line Tools；Windows 需要 MSVC C++ 工具链和 WebView2。

```sh
bun install --frozen-lockfile
bun run tauri dev
```

`bun run dev` 在浏览器中打开相同的界面，默认地址为 `http://127.0.0.1:1420`。浏览器使用独立的 IndexedDB 书库，可以用备份在浏览器和原生应用之间转移书籍。

| 平台 | 构建命令 | 环境 |
| --- | --- | --- |
| macOS | `bun run tauri build --bundles app` | macOS 14+，当前提供本机 Apple Silicon 构建 |
| Windows | `bun run tauri build` | Windows 11，近期 WebView2 |
| iOS | `bun run tauri ios build --debug --target aarch64-sim` | 完整 Xcode、iOS SDK、Apple Silicon 模拟器，最低 iOS 17 |
| Android | `bun run tauri android build --debug --apk --target aarch64` | JDK、Android SDK 37、NDK、Rust Android target，最低 API 30，近期系统 WebView |

桌面端使用系统窗口装饰。移动端原生工程在 `src-tauri/gen`。iOS 真机分发还需要配置自己的开发团队和签名。仓库提供手动触发的四平台构建工作流。

## 使用书库

- 单击书墙上的封面选书，底部阅读栏提供继续阅读。双击封面、在选中的封面上按 Enter，或点击列表行均可打开书籍。
- 轻点正文显示阅读工具。EPUB 支持重排、翻页、目录、书内搜索和 CFI 续读。PDF 使用本地 PDF.js Worker、可选文字层、页码导航和适合页面／宽度。Markdown 支持标题、列表、表格和代码块。
- 分类、搜索、排序、重命名、批量移动和删除都在书库完成。删除后可以撤销。单本导出保留原件字节，多本导出为 ZIP。
- 设置中的字号、行距、字体和纸色可以跨阅读会话保留。「本地存储」显示实际书库位置，并可导出或恢复书库备份。恢复会合并书目并采用备份里同一书目的阅读记录。
- macOS 使用 ⌘ K 搜索书库、⌘ O 导入、⌘ F 搜索正文。Windows 将 ⌘ 换成 Ctrl。

## 存储与验证

原生应用在系统应用数据目录下创建 `library/`。macOS 默认为 `~/Library/Application Support/app.hearthread.reader/library/`。当前版本使用一个本地读者身份，远端账户与 S3 同步留在后续版本。

```sh
bun run build
bun run test:native
bun run test:e2e
bun run test:webview
```

端到端测试默认使用已安装的 Google Chrome。使用 Playwright 自带 Chromium 时，先运行 `bunx playwright install chromium`，再设置 `PLAYWRIGHT_CHANNEL=chromium`。提供 `HEARTHREAD_TEST_EPUB`、`HEARTHREAD_TEST_PDF` 两个本地文件路径会启用个人书库验收用例。`test:webview` 在原生 WebView 中使用一次性书库，独立于日常阅读数据。

[架构与开源调研](docs/architecture.md) · [v0.1 验收记录](docs/verification/README.md) · [交互设计原稿](docs/design/v0.1/index.html)
