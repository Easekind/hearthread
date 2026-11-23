# 本地阅读架构与技术选型

## 从开源实现中采用的设计

| 项目与版本依据                                                                                                                                                                                                            | 采用的做法                                                                 | 在 hearthread 的落点                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Tauri 2](https://github.com/tauri-apps/tauri) 与 [Vite 配置](https://v2.tauri.app/start/frontend/vite/)                                                                                                                  | 各平台复用 React 页面，IPC 处理原生文件操作                                | 独立的 Rust 库入口、移动端入口、按窗口配置的能力与只读资源范围                                                                                                                                          |
| [Readest 的 FoliateViewer](https://github.com/readest/readest/blob/4bd787e274def5cc648422045e0e9f46b6038989/apps/readest-app/src/app/reader/components/FoliateViewer.tsx)                                                 | 阅读视图有独立生命周期；定位事件和 iframe 内交互桥接给外层应用             | `src/reader/Epub.tsx` 打开、监听、恢复 CFI、释放视图和书籍资源                                                                                                                                          |
| [本地优化版 foliate-js](https://github.com/readest/foliate-js/tree/fd05acdeb0a1dc16752d252bbb4bf6971e175450)                                                                                                              | 复用分章加载、排版分页、长章节切分、固定版式及搜索接口                     | `public/foliate` 固定该提交的 EPUB 运行时子集。应用只走 EPUB 路径。固定版式使用现代 WebView 自带的可构造样式表                                                                                          |
| [Mozilla PDF.js 示例](https://mozilla.github.io/pdf.js/examples/) 与 [Readest 的 PDF Worker 配置](https://github.com/readest/readest/blob/4bd787e274def5cc648422045e0e9f46b6038989/apps/readest-app/src/libs/document.ts) | 独立解析 Worker、按页取 viewport、控制 canvas 尺寸；资源地址按应用来源解析 | 只挂载当前页，高 DPI 绘制有像素预算。并行生成可选文字层，换页取消旧任务，关闭时销毁 loading task                                                                                                        |
| [react-markdown](https://github.com/remarkjs/react-markdown) 与 [remark-gfm](https://github.com/remarkjs/remark-gfm)                                                                                                      | 语法树生成 React 元素，GFM 扩展表格等语法                                  | 读取独立文档，跳过原始 HTML；锚点在阅读层定位，用户点击外链后交由平台打开                                                                                                                               |
| [shadcn/ui](https://ui.shadcn.com/docs/components/radix/dialog)                                                                                                                                                           | 在仓库内维护组件源码，复用 Radix 的焦点管理与键盘交互                      | Button、Switch 和 Slider 在 `src/ui/` 中维护。外观开关、排版滑动条与 EPUB 章节滑动条复用设计稿样式，分别由 Radix Switch 和 Slider 处理输入。书库使用原稿图标，存储详情使用 Lucide 与按需加载的 Recharts |
| [rusqlite](https://github.com/rusqlite/rusqlite)                                                                                                                                                                          | 在 Rust 层使用随应用打包的 SQLite                                          | 参数化 SQL、WAL、FULL 同步、每批变更使用一个事务                                                                                                                                                        |

Bun 和 Cargo 分别通过 `bun.lock` 和 `Cargo.lock` 锁定依赖版本。Bun 版本在 `package.json` 的 `packageManager` 中指定，CI 按此版本执行冻结安装。项目级 `.npmrc` 指定公共注册表，保证本地和 CI 使用同一依赖来源。React 19、TypeScript 7、Tailwind CSS 4、Vite 8、PDF.js 6 和 Tauri 2 组成首版技术栈。生产资源随安装包分发，阅读引擎、CMap、字体和解码器均可离线加载。

## 读写路径

`src/storage/files.ts` 定义与位置无关的 `LibraryFiles`。应用通过 `put` 提交不可变内容并取得 SHA-256 键，通过 `url` 获取有释放方法的读取句柄；`records` 和 `commit` 管理带修订号的记录。书目、备份与阅读位置只持有逻辑键。原生适配器调用 Rust，浏览器适配器使用 IndexedDB。

```text
library/
  catalog.sqlite3        书目、分类、读者设置、定位记录
  objects/<sha256>       原文件、导入的封面与字体
```

1. 导入先识别类型。EPUB 读取元数据和封面，原生适配器以 2 MiB 分块发送文件。Rust 校验偏移、累计长度和摘要，并在同一文件系统内发布临时文件。
2. 所有原件就绪后，书目变更在单个事务中提交。相同内容共享文件。中断发生在索引提交前时，已发布的对象可能暂时没有引用，已提交的书目仍然有效。
3. `books/<id>` 存共享书目，`profiles/local/reading/<id>` 和 `profiles/local/settings` 存个人状态。EPUB 使用 CFI，PDF 使用页码，滚动文档使用相对位置。应用合并密集定位事件，退出阅读时等待最终记录提交。
4. 每次提交携带上次读取的版本。SQLite 通过条件更新检测过期写入，并回滚整批变更。软删除保留可撤销记录。备份包含版本化 JSON 和引用对象，恢复在提交索引前校验每个对象的摘要。
5. 可通过同一接口扩展远端适配器。S3 版本需要定义读者身份、索引发布、并发冲突策略、离线重试与删除回收。当前 SQLite 文件及其活动 WAL 由本地进程管理，整库备份提供一致的跨设备传输入口。

## 界面来源与维护

视觉依据是 `docs/design/v0.1/index.html` 的最终交互稿。重建脚本引用工作区未提供的上一版原稿。应用从完整 HTML 提取实际字体、封面艺术、印刷图形、图标与层叠样式。运行 `node scripts/design-assets.mjs` 可重建这些资源与原创 EPUB、Markdown 样章；`node scripts/sample-pdf.mjs` 生成可导出的 PDF 样张。

React 组件控制真实交互与持久化。原稿 CSS 作为独立静态资源加载，避免构建器重新计算颜色和子像素值。Tailwind 用于额外操作界面，保留设计稿的默认样式。PDF、Markdown、设置和统计图表使用动态导入。书内内容只进入对应渲染器。EPUB 章节带独立内容安全策略；HTML 事件属性和活动内容在创建阅读文档前移除。

## 配置和工具经验

- Git 通过 Husky 在提交前运行 `bun run check`。构建和提交共用 tsrs 类型检查。Oxfmt 保留按原文拼接的交互稿片段和提取资源，Oxlint 检查这些片段时允许其他片段引用顶层声明。第三方 EPUB 运行时和生成的平台工程由各自的更新流程维护。

- `src-tauri/tauri.conf.json` 管理系统目标、桌面窗口与 CSP；`capabilities/default.json` 限制原生能力。导出原件通过系统保存对话框取得目标。开发与验收书库使用不同的应用标识。
- WKWebView 18.6 缺少新版 PDF.js 默认构建用到的 Map 方法。主模块与 Worker 统一采用同版本的 legacy 构建，自带所需兼容层。解码器路径使用绝对应用 URL，由主页面代读资源。
- 浏览器验收使用独立的 `.qa-dist` 生产构建，避免开发服务器热更新或同时打包原生应用中断测试。截图比较等待网络和字体就绪。
- macOS、Windows 共用 Tauri 桌面入口。iOS 工程由 Tauri CLI 生成。当前主机缺少 Android SDK/NDK，Android 工程按锁定的 [Tauri CLI 模板](https://github.com/tauri-apps/tauri/tree/9319e539f34237035cb4693bed9246660bc0a926/crates/tauri-cli/templates/mobile/android) 展开，保留官方 Gradle wrapper、Kotlin 桥接和本项目图标。在完整 SDK 环境可运行 `bun run tauri android init` 重新生成。
- 本地原文件与数据库在同一书库下，整库 ZIP 的创建和展开会占用与备份大小相关的内存。字体与开源许可随应用打包，构建脚本从已安装的生产依赖中提取第三方许可清单。

更新优化版 EPUB 引擎时，可执行 `node scripts/vendor-epub.mjs ../foliate-js`。脚本读取指定仓库 HEAD 的已提交文件，保存提交号到 `public/foliate/REVISION`。升级后应复测固定版式、长章节、选词、跳转及阅读位置恢复。
