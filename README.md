# hearthread

English · [简体中文](README.zh-CN.md)

hearthread is a local-first, cross-platform personal library that starts with immersive reading and is growing to bring books, documents and images together in one place.

![The book wall with twelve covers and the selected book in the reading bar](docs/verification/library-desktop.png)

![A sample chapter in reading view with the controls tucked away](docs/verification/reader-desktop.png)

## Features

- **One personal library.** Organize EPUB books, PDFs and Markdown documents by category and search them from one shelf. Image management is planned.
- **Immersive reading.** Tap the page to hide the controls, choose a font and line spacing that feel comfortable, and return to the passage where you left off.
- **Desktop and mobile.** hearthread targets macOS, Windows, iOS and Android. A library backup lets you carry your books and reading positions to another device.
- **Efficient rendering.** EPUB chapters load on demand. The PDF reader draws only the current page and cancels unfinished rendering when you turn the page.

## Local development

Use Bun 1.3.10 and Node.js 22.23 or later. To run the native app, install stable Rust and the tools for your platform. On macOS, install Xcode Command Line Tools. On Windows, install the MSVC C++ build tools and WebView2. [Tauri platform prerequisites](https://v2.tauri.app/start/prerequisites/)

From the repository root, install dependencies and launch the desktop app.

```sh
bun install --frozen-lockfile
bun run tauri dev
```

For browser development, run `bun run dev` and open `http://127.0.0.1:1420`. The browser keeps its own library in IndexedDB. The native app stores files and a SQLite catalog in its application data directory. You can transfer a library between them with a ZIP backup.

| Build target | Command |
| --- | --- |
| macOS app | `bun run tauri build --bundles app` |
| Windows desktop | `bun run tauri build` |
| iOS simulator on Apple Silicon | `bun run tauri ios build --debug --target aarch64-sim` |
| Android arm64 debug APK | `bun run tauri android build --debug --apk --target aarch64` |
