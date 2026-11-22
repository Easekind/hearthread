# Working on hearthread

English · [简体中文](AGENTS.zh-CN.md)

This guide applies to the whole repository. hearthread is a local-first personal library built with Tauri, React and TypeScript. The current release reads EPUB, PDF and Markdown for a single local reader. Image collections and multi-user sync are planned.

## Run the project

From the repository root, run `bun install --frozen-lockfile`. Use the Bun version pinned in `package.json`. Start the browser UI with `bun run dev` or the native app with `bun run tauri dev`. Run `bun run build` to type-check and build the frontend. These scripts also generate the runtime license notices. Platform setup and build commands are in the [README](README.md).

## UI and reader changes

- Use the interactive HTML in `docs/design/v0.1/index.html` as the visual reference. The shelf lives in `src/library/`, shared controls and settings in `src/ui/`. Keep the extracted stylesheet `public/design/edition.css` loaded as a static asset. Re-extract design assets with `node scripts/design-assets.mjs` when the source design changes.
- Start reader changes in `src/reader/Reader.tsx` and `engine.ts` in the same directory. Sample chapters have a separate rendering path. Exercise the affected format with an imported file when changing pagination, search or resume.
- For EPUB layout or performance issues, consult the optimized fork in the sibling checkout `../foliate-js` and reader implementations in `../readest` when available. To update the bundled EPUB engine, run `node scripts/vendor-epub.mjs ../foliate-js` and review the generated diff including `public/foliate/REVISION`.
- In `src/reader/Pdf.tsx`, keep the PDF.js main module and worker on the same legacy build for WKWebView. Vite copies the fonts, CMaps and decoders for offline use. Keep rendering bounded to the active page and cancel stale render tasks. Markdown uses `react-markdown` with raw HTML disabled.

## Storage and reading positions

Use `LibraryFiles` in `src/storage/files.ts` for file and catalog access. The native adapter uses Rust and SQLite in `src-tauri/src/store.rs`. Browser development uses a separate IndexedDB library. Persist SHA-256 object keys in records and call `release()` on a reading URL when finished.

Write immutable objects before committing the catalog. Submit related changes together with their expected revisions so conflicts roll back the batch. Shared book metadata lives under `books/<id>`. Keep positions and preferences under `profiles/local/`. Preserve EPUB CFIs, one-based PDF pages and relative Markdown scroll positions across reloads.

Use the versioned ZIP format in `src/storage/backup.ts` for transfers. Restore verifies object digests before committing records. The native SQLite database and its active WAL belong to the local process.

## Verify the change

| Change | Check from the repository root |
| --- | --- |
| Shelf, settings or reader layout | `bun run test:e2e tests/design.spec.ts` compares the app with the HTML reference at desktop and phone sizes. Inspect the application, reference and difference images in `test-results/`. |
| Import, reading, library management or backup | `bun run test:e2e` tests the production frontend in an isolated `.qa-dist` build. |
| Native storage or revision handling | `bun run test:native` exercises chunked writes, deduplication, rollback and reopening the catalog. |
| Native asset URLs, PDF worker or reader persistence | On macOS, run `bun run test:webview` in a desktop session. It uses a separate test library. |

Playwright uses installed Chrome by default. For bundled Chromium, run `bunx playwright install chromium` and set `PLAYWRIGHT_CHANNEL=chromium`. Optional personal-library tests accept local paths through `HEARTHREAD_TEST_EPUB` (at least six contents entries) and `HEARTHREAD_TEST_PDF` (at least ten pages). Keep personal books outside the repository.

Record changes to architecture, dependencies and platform workarounds in the [architecture notes](docs/architecture.md). Record the actual platform and task when updating [verification results](docs/verification/README.md).
