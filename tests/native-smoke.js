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
  {
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
    throw Error(
      label +
        " " +
        JSON.stringify({
          hidden: document.hidden,
          renderer: renderer()?.localName,
          pages: pages().map(({ index, doc }) => [
            index,
            doc.readyState,
            doc.querySelector("canvas")?.width,
          ]),
          status: document.body.innerText.slice(-400),
        }),
    );
  }
  const query = (s) => document.querySelector(s);
  const renderer = () => query("foliate-view")?.renderer;
  const pages = () =>
    (renderer()?.getContents() ?? []).filter(
      ({ doc, index }) => doc && index != null,
    );
  const content = (selector) => pages()[0]?.doc.querySelector(selector);
  async function wheelTo(deltaY, label) {
    const doc = pages()[0].doc;
    doc.dispatchEvent(
      new doc.defaultView.WheelEvent("wheel", {
        deltaY,
        bubbles: true,
        cancelable: true,
      }),
    );
    await until(
      () => query(".page-position")?.textContent === label,
      "wheel to " + label,
    );
  }
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
    if (!initial.length) {
      if (document.documentElement.lang !== "en")
        throw Error("Expected English on first launch");
      await click('button[title="Settings"]');
      (await until(() => button("Language"), "language settings")).click();
      const localeMenu = await until(
        () => query('button[aria-label="Interface language, English"]'),
        "interface language",
      );
      localeMenu.focus();
      localeMenu.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowDown",
          bubbles: true,
          cancelable: true,
        }),
      );
      (await until(() => button("简体中文"), "Chinese option")).click();
      await until(
        () => document.documentElement.lang === "zh-CN",
        "apply Chinese",
      );
    } else {
      await click('button[title="设置"]');
      log.push("interface language survived SQLite reload");
    }
    (await until(() => button("阅读排版"), "reading preferences")).click();
    if (!initial.length) {
      const fontInput = await until(
        () => query('input[accept=".otf,.ttf,.woff2"]'),
        "font import",
      );
      const fontFiles = new DataTransfer();
      fontFiles.items.add(
        new File(
          [await (await fetch("/design/font-1.ttf")).blob()],
          "sample.ttf",
        ),
      );
      fontInput.files = fontFiles.files;
      fontInput.dispatchEvent(new Event("change", { bubbles: true }));
    }
    await until(
      () => query('button[aria-label="字体，Sora（已导入）"]'),
      "selected font family",
    );
    await until(
      () => query(".setting-row")?.textContent.includes("Sora"),
      "imported font family",
    );
    await click('button[aria-label="关闭面板"]');
    log.push("imported Sora is identified in native typography settings");
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
        () => content(".markdown-content")?.innerText.includes("原生验证"),
        "reopen Markdown",
      );
      await until(
        () => renderer()?.columnCount === 2 && renderer()?.page > 0,
        "resume two-page Markdown",
      );
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
      await click('.room-dock button[aria-label="目录"]');
      await until(
        () =>
          query(".contents-list [aria-current=location] span")?.textContent ===
          "随笔 30",
        "restore selected Markdown heading",
      );
      log.push("reopened original Markdown with its selected heading");
      await ipc("plugin:event|emit", {
        event: "smoke-result",
        payload: { ok: true, log },
      });
      return;
    }
    const inputFiles = new DataTransfer();
    inputFiles.items.add(
      new File(
        [
          "# 原生验证\n\n" +
            Array.from(
              { length: 60 },
              (_, i) => "## 随笔 " + i + "\n\n阅读进度必须保留。",
            ).join("\n\n"),
        ],
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
      if (book.type === "EPUB") {
        await until(
          () => query(".page-position")?.textContent === "第 1 页",
          "EPUB relocate",
        );
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
        await click('.room-dock button[aria-label="阅读排版"]');
        button("双屏").click();
        await until(() => renderer()?.columnCount === 2, "two-page EPUB");
        await click('button[aria-label="关闭阅读排版"]');
        await wheelTo(5, "第 3–4 页");
        await wheelTo(-3, "第 1–2 页");
        await click('.room-dock button[aria-label="目录"]');
        await click(".contents-list button:nth-child(3)");
        await until(
          () => pages().some(({ index }) => index === 2),
          "open Reading chapter",
        );
        await query("foliate-view").next();
        await query("foliate-view").prev();
        for (let i = 0; i < 2; i++) {
          await click('.room-dock button[aria-label="目录"]');
          await until(
            () =>
              query(".contents-list [aria-current=location] span")
                ?.textContent === "阅读",
            "selected EPUB chapter after returning to its opening spread",
          );
          await click('button[aria-label="关闭目录"]');
        }
        await click('.room-dock button[aria-label="阅读排版"]');
        button("单屏").click();
        await click('button[aria-label="关闭阅读排版"]');
      }
      if (book.type === "PDF") {
        await until(
          () =>
            content(".textLayer")?.textContent.includes("Architecture") &&
            content("canvas")
              ?.getContext("2d")
              .getImageData(
                0,
                0,
                content("canvas").width,
                content("canvas").height,
              )
              .data.some((value, i) => i % 4 === 0 && value < 100 && value > 0),
          "PDF text and raster render",
        );
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
        await click('.room-dock button[aria-label="阅读显示"]');
        button("双屏").click();
        await until(
          () =>
            pages()[1]?.doc.querySelector(".textLayer")?.textContent.length > 0,
          "second PDF text layer",
        );
        const sheets = pages().map(({ doc }) =>
          doc.defaultView.frameElement.getBoundingClientRect(),
        );
        if (sheets[1].left < sheets[0].right - 1)
          throw Error("PDF pages overlap");
        button("单屏").click();
        await click('button[aria-label="关闭阅读显示"]');
        await wheelTo(5, "第 2 页");
        await until(
          () => pages()[0]?.index === 1 && content(".textLayer")?.textContent,
          "read PDF page two",
        );
        await click('button[aria-label="返回书库"]');
        await until(() => !query(".reading-layer"), "close PDF");
        await click('[data-focus-book="' + book.id + '"]');
        await click(".read-button");
        await until(
          () => pages()[0]?.index === 1 && content(".textLayer")?.textContent,
          "resume PDF page two",
        );
        log.push("PDF reopened on its second original page");
      }
      if (book.type === "MD") {
        await until(() => content(".markdown-content h1"), "Markdown render");
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
        await click('.room-dock button[aria-label="阅读排版"]');
        (await until(() => button("双屏"), "two-page option")).click();
        await until(() => renderer()?.columnCount === 2, "two-page layout");
        await click('button[aria-label="关闭阅读排版"]');
        await wheelTo(5, "第 3–4 页");
        await until(() => renderer()?.page > 0, "next Markdown spread");
        await click('.room-dock button[aria-label="目录"]');
        await click(".contents-list button:nth-child(32)");
        await until(() => {
          const heading = content(".markdown-content h2:nth-of-type(31)");
          if (!heading) return false;
          const rect = heading.getBoundingClientRect();
          const frame =
            heading.ownerDocument.defaultView.frameElement.getBoundingClientRect();
          return (
            frame.left + rect.left >= 0 && frame.left + rect.left < innerWidth
          );
        }, "visible Markdown destination");
        await click('.room-dock button[aria-label="目录"]');
        await until(
          () =>
            query(".contents-list [aria-current=location] span")
              ?.textContent === "随笔 30",
          "selected Markdown heading",
        );
        await click('button[aria-label="关闭目录"]');
        await click('button[aria-label="书内搜索"]');
        const field = query('input[type="search"][aria-label="搜索本书"]');
        Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value",
        ).set.call(field, "阅读进度");
        field.dispatchEvent(new Event("input", { bubbles: true }));
        const group = await until(
          () =>
            Array.from(document.querySelectorAll(".search-group")).find(
              (el) =>
                el.querySelector("summary span").textContent === "随笔 30",
            ),
          "chapter search group",
        );
        group.querySelector(".search-hit").click();
        await until(
          () =>
            pages().some(({ doc }) => {
              const found = doc.defaultView.CSS.highlights.get("found-passage");
              return (
                found &&
                [...found].some((range) => range.toString() === "阅读进度")
              );
            }),
          "selected passage highlight",
        );
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
