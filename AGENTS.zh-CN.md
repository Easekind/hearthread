# 在 hearthread 仓库中开发

[English](AGENTS.md) · 简体中文

本指南适用于整个仓库。hearthread 是基于 Tauri、React 和 TypeScript 的本地优先个人资料库。当前版本供单个本地读者阅读 EPUB、PDF 和 Markdown。图片管理和多人同步属于后续规划。

## 运行项目

在仓库根目录执行 `bun install --frozen-lockfile`，Bun 版本以 `package.json` 为准。运行 `bun run dev` 启动浏览器界面，或用 `bun run tauri dev` 启动原生应用。`bun run build` 会检查类型并构建前端。启动开发服务和构建时，脚本会生成运行时依赖的许可清单。各平台环境和构建命令见 [README 中文版](README.zh-CN.md)。

## 修改界面和阅读器

- 视觉对照以 `docs/design/v0.1/index.html` 的交互稿为准。书墙在 `src/library/`，通用控件和设置在 `src/ui/`。从设计稿提取的 `public/design/edition.css` 作为静态文件加载。设计源稿变动后，用 `node scripts/design-assets.mjs` 重新提取资源。
- 修改阅读器先看 `src/reader/Reader.tsx` 和同目录的 `engine.ts`。内置样章有独立的渲染路径。调整分页、搜索或续读时，导入对应格式的文件验证。
- 遇到 EPUB 排版或性能问题，优先参考工作区同级目录中的优化版 `../foliate-js` 和 `../readest` 的阅读器实现。升级内置 EPUB 引擎时，运行 `node scripts/vendor-epub.mjs ../foliate-js`，检查生成的改动和 `public/foliate/REVISION` 中的提交号。
- `src/reader/Pdf.tsx` 中的 PDF.js 主模块和 Worker 使用同版本的 legacy 构建以兼容 WKWebView。Vite 会复制离线所需的字体、CMap 和解码器。只渲染当前页，换页时取消旧任务。Markdown 使用 `react-markdown`，禁用原始 HTML。

## 存储和阅读位置

文件和书目操作统一走 `src/storage/files.ts` 中的 `LibraryFiles`。原生适配器调用 `src-tauri/src/store.rs` 中的 Rust 和 SQLite 实现，浏览器使用独立的 IndexedDB 书库。书目记录保存文件的 SHA-256 键。读取结束后，调用读取句柄的 `release()` 释放资源。

先写入不可变对象，再提交书目。把相关变更连同预期修订号放进同一批次，冲突时整批回滚。共享书目保存在 `books/<id>` 下，阅读位置和偏好保存在 `profiles/local/` 下。重新打开文件时，EPUB 按 CFI 恢复，PDF 按从 1 开始的页码恢复，Markdown 按相对滚动位置恢复。

书库迁移使用 `src/storage/backup.ts` 定义的带版本号 ZIP 格式。恢复时先校验对象摘要，再提交记录。原生 SQLite 数据库及其活动 WAL 文件由本地进程管理。

## 验证改动

| 改动 | 在仓库根目录运行 |
| --- | --- |
| 书墙、设置或阅读页布局 | `bun run test:e2e tests/design.spec.ts` 在桌面和手机尺寸下与 HTML 原稿对照。应用截图、原稿截图和差异图保存在 `test-results/`。 |
| 导入、阅读、书库管理或备份 | `bun run test:e2e` 在独立的 `.qa-dist` 生产构建上执行浏览器测试。 |
| 原生存储或修订冲突处理 | `bun run test:native` 验证分块写入、去重、回滚和重新打开书库。 |
| 原生资源地址、PDF Worker 或阅读位置持久化 | 在 macOS 桌面会话中运行 `bun run test:webview`，它使用独立的测试书库。 |

Playwright 默认使用已安装的 Chrome。使用自带 Chromium 时，先运行 `bunx playwright install chromium`，再设置 `PLAYWRIGHT_CHANNEL=chromium`。可选的个人书库用例通过环境变量读取本地路径。`HEARTHREAD_TEST_EPUB` 对应的书至少需要六个目录项，`HEARTHREAD_TEST_PDF` 对应的文件至少需要十页。个人书籍放在仓库之外。

调整架构、依赖或平台兼容方案时，更新[架构笔记](docs/architecture.md)。更新验收记录时，写明实际验证的平台和操作。[验收记录](docs/verification/README.md)
