// Compiled only into the optional native test executable.
(async () => {
  const ipc = window.__TAURI_INTERNALS__.invoke,
    log = [];
  const note = (message) =>
    ipc("plugin:event|emit", { event: "smoke-step", payload: String(message) });
  window.addEventListener("error", (e) => note(e.message));
  window.addEventListener("unhandledrejection", (e) => note(e.reason));
  // WKWebView suppresses animation frames when the macOS desktop session is hidden.
  // Keep PDF.js's real canvas renderer scheduled in this test-only executable.
  if (document.hidden) {
    const request = window.requestAnimationFrame.bind(window),
      cancel = window.cancelAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) =>
      document.hidden
        ? -setTimeout(() => cb(performance.now()), 16)
        : request(cb);
    window.cancelAnimationFrame = (id) =>
      id < 0 ? clearTimeout(-id) : cancel(id);
  }
  const originalError = console.error;
  console.error = (...args) => {
    void note(args.join(" "));
    originalError(...args);
  };
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  async function until(check, label) {
    const end = Date.now() + 22000;
    while (Date.now() < end) {
      const alert = document.querySelector(".reader [role=alert]");
      if (alert) throw Error(alert.innerText);
      const value = check();
      if (value) return value;
      await sleep(50);
    }
    throw Error(label + " " + document.body.innerText.slice(-400));
  }
  const query = (s) => document.querySelector(s);
  const button = (name, owner = document) =>
    [...owner.querySelectorAll("button")].find(
      (b) => b.textContent.trim() === name && !b.disabled,
    );
  const click = async (s) => {
    (await until(() => query(s), s)).click();
    await sleep(60);
  };
  try {
    await until(() => query(".book-wall"), "library");
    const initial = await ipc("catalog");
    await note("catalog " + initial.length);
    if (initial.length) {
      const saved = initial.find(
        (r) =>
          r.key.startsWith("books/") &&
          JSON.parse(r.value).filename === "native-check.md",
      );
      const progress =
        saved &&
        initial.find(
          (r) =>
            r.key === "profiles/local/reading/" + JSON.parse(saved.value).id,
        );
      if (!progress || !Number(JSON.parse(progress.value).location))
        throw Error(
          "Missing persisted reading position " + JSON.stringify(progress),
        );
      log.push("SQLite catalog and position survived reload");
      const digest = JSON.parse(saved.value).object;
      await click('[data-focus-book="' + digest + '"]');
      await click(".read-button");
      await until(
        () => query(".markdown-content")?.innerText.includes("原生验证"),
        "reopen Markdown",
      );
      await until(() => query(".reading-layer").scrollTop > 0, "resume scroll");
      log.push("reopened original Markdown from scoped native asset URL");
      await ipc("plugin:event|emit", {
        event: "smoke-result",
        payload: { ok: true, log },
      });
      return;
    }
    const inputFiles = new DataTransfer();
    inputFiles.items.add(
      new File(
        ["# 原生验证\n\n" + "阅读进度必须保留。\n\n".repeat(180)],
        "native-check.md",
        { type: "text/markdown" },
      ),
    );
    for (const [path, name, mime] of [
      ["/samples/walden.epub", "native.epub", "application/epub+zip"],
      ["/samples/pdf.pdf", "native.pdf", "application/pdf"],
    ]) {
      const r = await fetch(path);
      inputFiles.items.add(new File([await r.blob()], name, { type: mime }));
    }
    await click(".import-button");
    const input = query("#import-files");
    input.files = inputFiles.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    (await until(() => button("导入 3 本"), "queue")).click();
    await until(() => !query(".app-modal"), "commit native import");
    const records = (await ipc("catalog"))
      .filter((r) => r.key.startsWith("books/"))
      .map((r) => JSON.parse(r.value));
    if (records.length !== 3) throw Error("Missing SQLite book records");
    for (const book of records.sort((a, b) =>
      a.type === "MD" ? 1 : b.type === "MD" ? -1 : 0,
    )) {
      await note("opening " + book.type);
      await click('[data-focus-book="' + book.id + '"]');
      await click(".read-button");
      if (book.type === "EPUB")
        await until(
          () => query(".chapter-position span")?.textContent.includes("/ 4"),
          "EPUB relocate",
        );
      if (book.type === "PDF")
        await until(
          () =>
            query(".textLayer")?.textContent.includes("Architecture") &&
            query("canvas")
              ?.getContext("2d")
              .getImageData(0, 0, query("canvas").width, query("canvas").height)
              .data.some((value, i) => i % 4 === 0 && value < 100 && value > 0),
          "PDF text and raster render",
        );
      if (book.type === "MD") {
        await until(() => query(".markdown-content h1"), "Markdown render");
        query(".reading-layer").scrollTop = 500;
      }
      await sleep(400);
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      await until(() => !query(".reading-layer"), "close reader");
      log.push(book.type + " read");
    }
    await sleep(350);
    console.log(log);
    location.reload();
  } catch (e) {
    await ipc("plugin:event|emit", {
      event: "smoke-result",
      payload: { ok: false, error: String(e), log },
    });
  }
})();
