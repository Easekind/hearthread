import type { EpubView } from "../src/reader/foliate";
import { markdown, pdfPages, readingPage, columnCount } from "./reader-surface";
import { test, expect, type Page } from "./chinese-library";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
async function upload(
  page: Page,
  file: { name: string; mimeType: string; buffer: Buffer },
) {
  await page
    .getByRole("button", { name: "导入书籍", exact: true })
    .first()
    .click();
  await page.locator("#import-files").setInputFiles(file);
  await page.getByRole("button", { name: "导入 1 本", exact: true }).click();
  await expect(page.locator(".app-modal")).toHaveCount(0);
}
async function tools(page: Page) {
  await expect(page.locator("foliate-view")).toBeAttached();
  await expect(page.locator(".reader-loading")).toHaveCount(0);
  await page.locator(".reading-layer").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "返回书库" })).toBeVisible();
}
test("Markdown file import, search, resume, deduplication and byte-for-byte export", async ({
  page,
}) => {
  const file = {
    name: "读书随笔.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(
      "# 读书随笔\n\n" +
        Array.from(
          { length: 40 },
          (_, i) => "## 随笔 " + i + "\n\n今天记下第 " + i + " 页。",
        ).join("\n\n"),
    ),
  };
  await page.goto("/");
  await upload(page, file);
  await page
    .getByRole("button", { name: "选择 读书随笔", exact: true })
    .dblclick();
  await expect(markdown(page).locator("h2")).toHaveCount(40);
  await tools(page);
  await page.getByRole("button", { name: "书内搜索", exact: true }).click();
  await page.getByLabel("搜索本书").fill("第 26 页");
  await page.locator("#book-results button").click();
  await expect.poll(() => readingPage(page)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "返回书库" }).click();
  await expect(page.locator(".reading-layer")).toHaveCount(0);
  await page.reload();
  await page
    .getByRole("button", { name: "选择 读书随笔", exact: true })
    .dblclick();
  await expect.poll(() => readingPage(page)).toBeGreaterThan(0);
  await tools(page);
  await page.getByRole("button", { name: "阅读排版", exact: true }).click();
  const paragraph = markdown(page).getByText("今天记下第 26 页。", {
    exact: true,
  });
  await page.getByRole("button", { name: "双屏", exact: true }).click();
  await expect(paragraph).toBeInViewport();
  const spread = page.locator("foliate-paginator");
  const offset = () => readingPage(page);
  const previous = await offset();
  expect(previous).toBeGreaterThan(0);
  await page.getByRole("button", { name: "关闭阅读排版" }).click();
  await page.getByRole("button", { name: "上一页" }).click();
  await expect.poll(offset).toBeLessThan(previous);
  const saved = await offset();
  await page.getByRole("button", { name: "返回书库" }).click();
  await expect(spread).toHaveCount(0);
  await page.reload();
  await page
    .getByRole("button", { name: "选择 读书随笔", exact: true })
    .dblclick();
  await expect.poll(() => columnCount(page)).toBe(2);
  await expect.poll(offset).toBe(saved);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect.poll(() => columnCount(page)).toBe(1);
  await page.setViewportSize({ width: 820, height: 1180 });
  await expect.poll(() => columnCount(page)).toBe(2);
  await page.keyboard.press("Escape");
  await upload(page, file);
  await expect(
    page.getByRole("button", { name: "选择 读书随笔", exact: true }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "读书随笔 的更多操作" }).click();
  const download = page.waitForEvent("download");
  await page.getByText("导出原文件", { exact: true }).click();
  expect(await readFile((await (await download).path())!)).toEqual(file.buffer);
});
test("EPUB repagination, contents and CFI resume", async ({ page }) => {
  const file = {
    name: "sample.epub",
    mimeType: "application/epub+zip",
    buffer: await readFile(resolve("public/samples/walden.epub")),
  };
  const id = createHash("sha256").update(file.buffer).digest("hex");
  await page.goto("/");
  await upload(page, file);
  await page.locator('[data-focus-book="' + id + '"]').dblclick();
  const body = page.frameLocator("foliate-view iframe").first().locator("body");
  await expect(body).toContainText("生计");
  await tools(page);
  await page.getByRole("button", { name: "阅读排版", exact: true }).click();
  const paginator = page.locator("foliate-paginator");
  const columns = () =>
    paginator.evaluate(
      (el) => (el as HTMLElement & { columnCount: number }).columnCount,
    );
  await expect.poll(columns).toBe(1);
  await page.getByRole("button", { name: "双屏", exact: true }).click();
  await expect.poll(columns).toBe(2);
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await expect.poll(columns).toBe(1);
    await expect(page.getByRole("group", { name: "页面布局" })).toHaveCount(0);
  }
  await page.getByRole("button", { name: "恢复默认排版" }).click();
  await page.setViewportSize({ width: 744, height: 1133 });
  await expect.poll(columns).toBe(2);
  await expect(
    page.getByRole("button", { name: "双屏", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "字体类别，衬线" }).click();
  await page.getByRole("menuitemradio", { name: "无衬线" }).click();
  await page.getByRole("button", { name: "字体，系统默认" }).click();
  const option = page.getByRole("menuitemradio").nth(1);
  const label = (await option.innerText()).trim();
  await option.click();
  await expect(
    page.getByRole("button", { name: "字体，" + label }),
  ).toBeVisible();
  const readerFamily = await page
    .locator(".reading-room")
    .evaluate((room) =>
      getComputedStyle(room).getPropertyValue("--reading-face").trim(),
    );
  await expect(body).toHaveCSS(
    "font-family",
    await page.evaluate((family) => {
      const el = document.createElement("span");
      el.style.fontFamily = family;
      return el.style.fontFamily;
    }, readerFamily),
  );
  await page.getByRole("slider", { name: "字号" }).press("Home");
  await page.getByRole("slider", { name: "行距" }).press("Home");
  await expect(body.locator("p").first()).toHaveCSS("line-height", "12px");
  await page.getByRole("button", { name: "跟随系统" }).click();
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(body).toHaveCSS("background-color", "rgb(32, 34, 32)");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(body).toHaveCSS("background-color", "rgb(252, 251, 248)");
  await page.getByRole("button", { name: "关闭阅读排版" }).click();
  await page.getByRole("button", { name: "目录", exact: true }).click();
  await page
    .locator(".contents-list button")
    .filter({ hasText: "声响" })
    .click();
  const toc = page.getByRole("button", { name: "目录", exact: true });
  await toc.click();
  await expect(page.locator(".contents-list [aria-current]")).toContainText(
    "声响",
  );
  await page.locator(".contents-list button").nth(2).click();
  await toc.click();
  await expect(page.locator(".contents-list [aria-current]")).toContainText(
    "阅读",
  );
  await page.getByRole("button", { name: "关闭目录" }).click();

  await page.getByRole("button", { name: "返回书库" }).click();
  await expect(page.locator(".reading-layer")).toHaveCount(0);
  await page.reload();
  await page.locator('[data-focus-book="' + id + '"]').dblclick();
  await tools(page);
  await toc.click();
  await expect(page.locator(".contents-list [aria-current]")).toContainText(
    "阅读",
  );
  await expect.poll(columns).toBe(2);
});
test("PDF opens original page, text layer and page search", async ({
  page,
}) => {
  const file = {
    name: "Reading.pdf",
    mimeType: "application/pdf",
    buffer: await readFile(resolve("public/samples/pdf.pdf")),
  };
  await page.goto("/");
  await upload(page, file);
  await page
    .getByRole("button", { name: "选择 Reading", exact: true })
    .dblclick();
  const frames = pdfPages(page);
  const sheet = (i: number) => frames.nth(i).contentFrame();
  await expect(sheet(0).locator(".textLayer")).toContainText("Architecture");
  await tools(page);
  await page.getByRole("button", { name: "阅读显示", exact: true }).click();
  await page.getByRole("button", { name: "跟随系统" }).click();
  await page.emulateMedia({ colorScheme: "dark" });
  const canvas = sheet(0).locator("canvas");
  const filteredFrame = frames.first();
  await expect(filteredFrame).not.toHaveCSS("filter", "none");
  await expect(page.locator("body")).not.toHaveClass(/theme-dark/);
  await page.reload();
  await expect(filteredFrame).not.toHaveCSS("filter", "none");
  await tools(page);
  await page.getByRole("button", { name: "阅读显示", exact: true }).click();
  await expect(page.getByRole("button", { name: "跟随系统" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "双屏", exact: true }).click();
  await expect(frames).toHaveCount(2);
  await expect(sheet(1).locator(".textLayer")).not.toBeEmpty();
  const left = await canvas.boundingBox(),
    right = await sheet(1).locator("canvas").boundingBox();
  expect(right!.x).toBeGreaterThanOrEqual(left!.x + left!.width - 1);
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(frames).toHaveCount(1);
  await expect(page.getByRole("group", { name: "页面布局" })).toHaveCount(0);
  await expect(page.locator(".page-position")).toContainText("第 1 页");
  await page.setViewportSize({ width: 820, height: 1180 });
  await expect(frames).toHaveCount(2);
  await expect(page.locator(".page-position")).toContainText("第 1–2 页");
  await page.getByRole("button", { name: "单屏", exact: true }).click();
  await expect(frames).toHaveCount(1);
  await page.getByRole("button", { name: "暖纸" }).click();
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator(".reader")).toHaveAttribute("data-paper", "paper");
  await expect(filteredFrame).toHaveCSS("filter", "none");
  await page.getByRole("button", { name: "关闭阅读显示" }).click();
  await page.getByRole("button", { name: "书内搜索", exact: true }).click();
  await page.getByLabel("搜索本书").fill("Architecture");
  await expect(page.locator("#book-results summary").first()).toBeVisible();
  await page.locator("#book-results button").first().click();
  await page.getByRole("button", { name: "阅读显示", exact: true }).click();
  await page.getByLabel("切换 PDF 显示宽度").click();
  await expect(page.locator(".reader")).toHaveAttribute(
    "data-pdf-wide",
    "true",
  );
});

test("fixed-layout EPUB respects page layout at tablet width", async ({
  page,
}) => {
  const entries = unzipSync(
    await readFile("tests/fixtures/four-chapters.epub"),
  );
  entries["book.opf"] = strToU8(
    strFromU8(entries["book.opf"])
      .replace(
        "</metadata>",
        '<meta property="rendition:layout">pre-paginated</meta></metadata>',
      )
      .replace(
        '<itemref idref="c0"/>',
        '<itemref idref="c0" properties="page-spread-left"/>',
      ),
  );
  for (const name of Object.keys(entries).filter((name) =>
    name.endsWith(".xhtml"),
  )) {
    entries[name] = strToU8(
      strFromU8(entries[name]).replace(
        "<head>",
        '<head><meta name="viewport" content="width=540,height=800"/>',
      ),
    );
  }
  const buffer = Buffer.from(zipSync(entries));
  const id = createHash("sha256").update(buffer).digest("hex");
  await page.goto("/");
  await upload(page, {
    name: "fixed.epub",
    mimeType: "application/epub+zip",
    buffer,
  });
  await page.setViewportSize({ width: 744, height: 1133 });
  await page.locator('[data-focus-book="' + id + '"]').dblclick();
  const columns = () =>
    page
      .locator("foliate-fxl")
      .evaluate(
        (el) => (el as HTMLElement & { columnCount: number }).columnCount,
      );
  await expect.poll(columns).toBe(1);
  await tools(page);
  await page.getByRole("button", { name: "阅读排版", exact: true }).click();
  await page.getByRole("button", { name: "双屏", exact: true }).click();
  await expect.poll(columns).toBe(2);
  await page.getByRole("button", { name: "关闭阅读排版" }).click();
  await page.getByRole("button", { name: "下一页", exact: true }).click();
  await expect(page.locator(".page-position")).toHaveText("第 3–4 页");
  await page.getByRole("button", { name: "返回书库" }).click();
  await expect(page.locator(".reading-layer")).toHaveCount(0);
  await page.reload();
  await page.locator('[data-focus-book="' + id + '"]').dblclick();
  await expect.poll(columns).toBe(2);
  await expect(page.locator(".page-position")).toHaveText("第 3–4 页");
});

test("vertical EPUB uses the requested column count on a tall screen", async ({
  page,
}) => {
  const entries = unzipSync(
    await readFile("tests/fixtures/four-chapters.epub"),
  );
  for (const name of Object.keys(entries).filter((name) =>
    /^c\d+\.xhtml$/.test(name),
  )) {
    entries[name] = strToU8(
      strFromU8(entries[name]).replace(
        "<body>",
        '<body style="writing-mode:vertical-rl">',
      ),
    );
  }
  const buffer = Buffer.from(zipSync(entries));
  const id = createHash("sha256").update(buffer).digest("hex");
  await page.goto("/");
  await upload(page, {
    name: "vertical.epub",
    mimeType: "application/epub+zip",
    buffer,
  });
  await page.setViewportSize({ width: 780, height: 1280 });
  await page.locator('[data-focus-book="' + id + '"]').dblclick();
  const renderer = page.locator("foliate-paginator");
  const columns = () =>
    renderer.evaluate(
      (el) => (el as HTMLElement & { columnCount: number }).columnCount,
    );
  await expect(page.locator(".page-position")).toHaveText("第 1 页");
  await expect.poll(columns).toBe(1);
  await tools(page);
  await page.getByRole("button", { name: "阅读排版", exact: true }).click();
  await page.getByRole("button", { name: "双屏", exact: true }).click();
  await expect.poll(columns).toBe(2);
  await page.getByRole("button", { name: "单屏", exact: true }).click();
  await expect.poll(columns).toBe(1);
  await page.getByRole("button", { name: "关闭阅读排版" }).click();
  await swipe(page, 35, 0);
  await expect(page.locator(".page-position")).toHaveText("第 2 页");
  await swipe(page, -35, 0);
  await expect(page.locator(".page-position")).toHaveText("第 1 页");
});

for (const layout of ["单屏", "双屏"]) {
  test(layout + " EPUB 目录和正文使用同一导航条目", async ({ page }) => {
    const entries = unzipSync(
      await readFile("tests/fixtures/four-chapters.epub"),
    );
    entries["nav.xhtml"] = strToU8(
      strFromU8(entries["nav.xhtml"])
        .replace('<li><a href="c0.xhtml">林间的清晨</a></li>', "")
        .replace('<li><a href="c3.xhtml">湖畔的四季</a></li>', "")
        .replace(
          '<a href="c2.xhtml">阅读与独处</a>',
          '<a href="c2.xhtml">阅读与独处</a><ol><li><a href="c2.xhtml#part">独处时刻</a></li><li><a href="c2.xhtml#near">同页小节</a></li></ol>',
        ),
    );
    entries["c2.xhtml"] = strToU8(
      strFromU8(entries["c2.xhtml"]).replace(
        "</body>",
        "<p>阅读。</p>".repeat(90) +
          '<h2 id="part">独处时刻</h2><h3 id="near">同页小节</h3>' +
          "<p>独处。</p>".repeat(80) +
          "</body>",
      ),
    );
    const buffer = Buffer.from(zipSync(entries));
    const id = createHash("sha256").update(buffer).digest("hex");
    await page.goto("/");
    await upload(page, {
      name: "chapters.epub",
      mimeType: "application/epub+zip",
      buffer,
    });
    const book = page.locator('[data-focus-book="' + id + '"]');
    await book.dblclick();
    await expect(page.locator(".page-position")).toHaveText("第 1 页");
    await tools(page);
    if (layout === "双屏") {
      await page.getByRole("button", { name: "阅读排版", exact: true }).click();
      await page.getByRole("button", { name: layout, exact: true }).click();
      await page.getByRole("button", { name: "关闭阅读排版" }).click();
    }
    const toc = page.getByRole("button", { name: "目录", exact: true });
    const active = page.locator(".contents-list [aria-current=location]");
    await toc.click();
    await page
      .locator(".contents-list button")
      .filter({ hasText: "独处时刻" })
      .click();
    const visibleFrame = page
      .frameLocator("foliate-view iframe:not([aria-hidden=true] iframe)")
      .first();
    const heading = visibleFrame.locator("#part");
    await expect(heading).toBeInViewport();
    await toc.click();
    await expect(active).toContainText("独处时刻");
    const samePage = await page.locator(".page-position").innerText();
    await page
      .locator(".contents-list button")
      .filter({ hasText: "同页小节" })
      .click();
    await expect(visibleFrame.locator("#near")).toBeInViewport();
    await toc.click();
    await expect(active).toContainText("同页小节");
    await expect(page.locator(".page-position")).toHaveText(samePage);
    await page.getByRole("button", { name: "书内搜索", exact: true }).click();
    await page.getByLabel("搜索本书").fill("独处时刻");
    await page.locator("#book-results button").first().click();
    await expect(heading).toBeInViewport();
    await toc.click();
    await expect(active).toContainText("独处时刻");
    await page.getByRole("button", { name: "关闭目录" }).click();
    await page.getByRole("button", { name: "上一页", exact: true }).click();
    await expect(heading).not.toBeInViewport();
    await toc.click();
    await expect(active).toContainText("阅读与独处");
    await page.getByRole("button", { name: "关闭目录" }).click();
    await toc.click();
    await page.locator(".contents-list button").first().click();
    await expect(visibleFrame.locator("h1")).toHaveText("我生活的地方");
    await page.getByRole("button", { name: "返回书库" }).click();
    await book.dblclick();

    await expect(visibleFrame.locator("h1")).toHaveText("我生活的地方");
    await tools(page);
    await toc.click();
    await expect(active).toContainText("我生活的地方");
  });

  test(layout + " Markdown 目录定位到同屏内选定的标题", async ({ page }) => {
    await page.goto("/");
    await upload(page, {
      name: "章节.md",
      mimeType: "text/markdown",
      buffer: Buffer.from(
        Array.from(
          { length: 36 },
          (_, i) => "## 标题 " + i + "\n\n一段正文。",
        ).join("\n\n"),
      ),
    });
    await page
      .getByRole("button", { name: "选择 章节", exact: true })
      .dblclick();
    await expect(markdown(page).locator("h2")).toHaveCount(36);
    await tools(page);
    if (layout === "双屏") {
      await page.getByRole("button", { name: "阅读排版", exact: true }).click();
      await page.getByRole("button", { name: layout, exact: true }).click();
      await page.getByRole("button", { name: "关闭阅读排版" }).click();
    }
    const toc = page.getByRole("button", { name: "目录", exact: true });
    for (const index of [13, 14, 35]) {
      await toc.click();
      await page.locator(".contents-list button").nth(index).click();
      await expect(markdown(page).locator("h2").nth(index)).toBeInViewport();
      await toc.click();
      await expect(
        page.locator(".contents-list [aria-current=location] span"),
      ).toHaveText("标题 " + index);
      await expect(
        page.locator(".contents-list [aria-current=location]"),
      ).toBeInViewport();
      await page.getByRole("button", { name: "关闭目录" }).click();
    }
    await page.getByRole("button", { name: "阅读排版", exact: true }).click();
    await page
      .getByRole("button", {
        name: layout === "双屏" ? "单屏" : "双屏",
        exact: true,
      })
      .click();
    await page.getByRole("button", { name: "关闭阅读排版" }).click();
    await expect(markdown(page).locator("h2").last()).toBeInViewport();
    await toc.click();
    await expect(
      page.locator(".contents-list [aria-current=location] span"),
    ).toHaveText("标题 35");
    await page.getByRole("button", { name: "返回书库" }).click();
    await page
      .getByRole("button", { name: "选择 章节", exact: true })
      .dblclick();
    await expect(markdown(page).locator("h2").last()).toBeInViewport();
    await tools(page);
    await toc.click();
    await expect(
      page.locator(".contents-list [aria-current=location] span"),
    ).toHaveText("标题 35");
  });
}

for (const width of [390, 1440]) {
  test(`同一正文的 EPUB 与 Markdown 分页一致 · ${width}`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const paragraphs = Array.from(
      { length: 80 },
      (_, i) =>
        `第 ${i + 1} 段。山路旁有一排树，风从树叶间穿过。沿着小路继续往前走，远处是安静的湖面。`,
    );
    const entries = unzipSync(
      await readFile("tests/fixtures/four-chapters.epub"),
    );
    entries["c1.xhtml"] = strToU8(
      '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>分页</title></head><body>' +
        paragraphs.map((p) => "<p>" + p + "</p>").join("\n") +
        "</body></html>",
    );
    const captures: Buffer[] = [];
    const passages: string[] = [];
    for (const type of ["md", "epub"] as const) {
      const buffer =
        type === "md"
          ? Buffer.from(paragraphs.join("\n\n"))
          : Buffer.from(zipSync(entries));
      const id = createHash("sha256").update(buffer).digest("hex");
      await page.goto("/");
      await upload(page, {
        name: "分页." + type,
        mimeType: type === "md" ? "text/markdown" : "application/epub+zip",
        buffer,
      });
      await page.locator('[data-focus-book="' + id + '"]').dblclick();
      if (type === "epub") {
        await tools(page);
        await page.getByRole("button", { name: "目录", exact: true }).click();
        await page
          .locator(".contents-list button")
          .filter({ hasText: "我生活的地方" })
          .click();
        await page.locator(".reading-layer").focus();
        await page.keyboard.press("Enter");
      }
      const passage = () =>
        page
          .locator("foliate-view")
          .evaluate(
            (el) =>
              (
                el as HTMLElement & { lastLocation?: { range?: Range } }
              ).lastLocation?.range
                ?.toString()
                .trim() ?? "",
          );
      await expect.poll(passage).toMatch(/^第 1 段/);
      const firstPage = await readingPage(page);
      await expect(page.locator(".reader-loading")).toHaveCount(0);
      await page.locator(".reading-layer").focus();
      if (width === 390) await swipe(page, -200, 0);
      else await page.keyboard.press("ArrowRight");
      await expect.poll(() => readingPage(page)).toBe(firstPage + 1);
      await expect.poll(passage).not.toBe("");
      expect(await passage()).not.toMatch(/^第 1 段/);
      passages.push(await passage());
      await expect(page.locator("#toast-root")).toBeEmpty();
      captures.push(
        await page.screenshot({
          path: info.outputPath(type + ".png"),
          animations: "disabled",
        }),
      );
      await page.keyboard.press("Escape");
    }
    expect(passages[1]).toBe(passages[0]);
    expect(captures[0].equals(captures[1])).toBe(true);
  });
}

async function swipe(page: Page, dx: number, dy: number, delay = 0) {
  const session = await page.context().newCDPSession(page);
  try {
    await session.send("Emulation.setTouchEmulationEnabled", { enabled: true });
    const point = (fraction: number) => [
      { x: 250 + dx * fraction, y: 320 + dy * fraction },
    ];
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: point(0),
    });
    for (const fraction of [0.25, 0.5, 0.75, 1]) {
      if (delay) await page.waitForTimeout(delay);
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: point(fraction),
      });
    }
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
  } finally {
    await session.detach();
  }
}

test("手机 PDF 样书显示完整原页，横滑后续读", async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#read-4");
  const pages = pdfPages(page);
  await expect(
    pages.first().contentFrame().locator(".textLayer"),
  ).toContainText("Architecture");
  const canvas = pages.first().contentFrame().locator("canvas[width]");
  const bounds = await canvas.boundingBox();
  const bitmap = await canvas.evaluate((el: HTMLCanvasElement) => ({
    width: el.width,
    height: el.height,
    image: el.toDataURL(),
    scale: Number(
      el.ownerDocument
        .querySelector<HTMLElement>(".textLayer")!
        .style.getPropertyValue("--total-scale-factor"),
    ),
  }));
  // A populated text layer also exists when embedded fonts draw as boxes.
  // Compare the actual bitmap to PDF.js drawing the same page outside a frame.
  for (const module of ["pdf.mjs", "pdf.worker.mjs"])
    await page.route("**/__reference/" + module, (route) =>
      route.fulfill({
        path: resolve("node_modules/pdfjs-dist/legacy/build", module),
        contentType: "text/javascript",
      }),
    );
  const expected = await page.evaluate(
    async ({ width, height, scale }) => {
      const source = "/__reference/pdf.mjs";
      const pdfjs: typeof import("pdfjs-dist") = await import(source);
      pdfjs.GlobalWorkerOptions.workerSrc = "/__reference/pdf.worker.mjs";
      const task = pdfjs.getDocument({ url: "/samples/pdf.pdf" });
      try {
        const page = await (await task.promise).getPage(1);
        const reference = document.createElement("canvas");
        reference.width = width;
        reference.height = height;
        await page.render({
          canvas: reference,
          viewport: page.getViewport({ scale }),
        }).promise;
        return reference.toDataURL();
      } finally {
        await task.destroy();
      }
    },
    { width: bitmap.width, height: bitmap.height, scale: bitmap.scale },
  );
  expect(bitmap.image === expected).toBe(true);
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(845);
  await page.screenshot({ path: info.outputPath("pdf.png") });
  await swipe(page, -200, 0);
  await expect(page.locator(".page-position")).toContainText("第 2 页");
  await page.locator(".reading-layer").focus();
  await page.keyboard.press("Escape");
  await expect(page.locator(".reading-layer")).toHaveCount(0);
  await page.locator('[data-focus-book="4"]').dblclick();
  await expect(page.locator(".page-position")).toContainText("第 2 页");
  await expect(
    pages.first().contentFrame().locator(".textLayer"),
  ).not.toBeEmpty();
});

for (const [id, file, mimeType] of [
  ["1", "walden.epub", "application/epub+zip"],
  ["4", "pdf.pdf", "application/pdf"],
  ["5", "notes.md", "text/markdown"],
]) {
  test(file + " 内置与导入的正文、翻页及续读相同", async ({ page }, info) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const buffer = await readFile("public/samples/" + file);
    const pdf = mimeType === "application/pdf";
    const imported = createHash("sha256").update(buffer).digest("hex");
    await page.goto("/");
    await upload(page, { name: file, mimeType, buffer });
    await page.getByRole("button", { name: /按分类筛选/ }).click();
    await page.getByRole("menuitemradio", { name: "全部分类" }).click();
    const surface = page.locator(".book-surface");
    const current = async () => {
      if (pdf) return await page.locator(".page-position").innerText();
      return await page
        .locator("foliate-view")
        .evaluate(
          (el) =>
            (
              el as HTMLElement & { lastLocation?: { range?: Range } }
            ).lastLocation?.range
              ?.toString()
              .trim() ?? "",
        );
    };
    const capture = async (name: string) => {
      await expect(page.locator(".reader-loading")).toHaveCount(0);
      await expect(page.locator("#toast-root")).toBeEmpty();
      if (pdf)
        await expect(
          pdfPages(page).first().contentFrame().locator("canvas[width]"),
        ).toBeVisible();
      return surface.screenshot({
        path: info.outputPath(name + ".png"),
        animations: "disabled",
      });
    };
    const screenshots: Buffer[][] = [];
    for (const key of [id, imported]) {
      const book = page.locator('[data-focus-book="' + key + '"]');
      await book.dblclick();
      await expect.poll(current).not.toBe("");
      await tools(page);
      await page.getByRole("button", { name: "目录", exact: true }).click();
      const entries = page.locator(".contents-list button");
      // Exercise positions well past the opening spread in every original.
      const entry = pdf ? 59 : mimeType === "text/markdown" ? 17 : 5;
      const title = await entries.nth(entry).locator("span").innerText();
      await entries.nth(entry).click();
      await page.locator(".reading-layer").focus();
      await page.keyboard.press("Enter");
      await expect.poll(current).toContain(title);
      const before = await capture(key + "-open"),
        start = await current();
      if (pdf) {
        await page.mouse.move(190, 360);
        await page.mouse.wheel(0, 220);
      } else await swipe(page, -200, 0);
      await expect.poll(current).not.toBe(start);
      const next = await capture(key + "-next"),
        passage = await current();
      await page.locator(".reading-layer").focus();
      await page.keyboard.press("Escape");
      await expect(surface).toHaveCount(0);
      await page.reload();
      await book.dblclick();
      await expect.poll(current).toBe(passage);
      expect((await capture(key + "-resume")).equals(next)).toBe(true);
      screenshots.push([before, next]);
      await page.locator(".reading-layer").focus();
      await page.keyboard.press("Escape");
      await expect(surface).toHaveCount(0);
    }
    expect(screenshots[0][0].equals(screenshots[1][0])).toBe(true);
    expect(screenshots[0][1].equals(screenshots[1][1])).toBe(true);
  });
}

test("瓦尔登湖双屏跨章时反复打开目录保留选中的章首", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/#read-1");
  await tools(page);
  await page.getByRole("button", { name: "阅读排版", exact: true }).click();
  await page.getByRole("button", { name: "双屏", exact: true }).click();
  await page.getByRole("button", { name: "关闭阅读排版" }).click();
  const toc = page.getByRole("button", { name: "目录", exact: true });
  const checkMenu = async (chapter: string) => {
    await toc.click();
    await expect(
      page.locator(".contents-list [aria-current=location] span"),
    ).toHaveText(chapter);
    await page.getByRole("button", { name: "关闭目录" }).click();
  };
  for (const chapter of ["我生活的地方", "阅读"]) {
    await toc.click();
    await page
      .locator(".contents-list button")
      .filter({ hasText: chapter })
      .click();
    await checkMenu(chapter);
  }
  const headingOnRight = () =>
    page.locator("foliate-view").evaluate((el) => {
      const view = el as EpubView;
      const doc = view.renderer
        .getContents()
        .find((section) => section.index === 2)?.doc;
      const frame = doc?.defaultView?.frameElement;
      const heading = doc?.querySelector("h1");
      if (!frame || !heading) return false;
      const x =
        frame.getBoundingClientRect().left +
        heading.getBoundingClientRect().left;
      return x >= window.innerWidth / 2 && x < window.innerWidth;
    });
  const turn = (direction: "next" | "prev") =>
    page.locator("foliate-view").evaluate(async (el, direction) => {
      const view = el as EpubView;
      await view[direction]();
    }, direction);
  await expect.poll(headingOnRight).toBe(true);
  await checkMenu("阅读");
  await turn("next");
  await expect.poll(headingOnRight).toBe(false);
  await turn("prev");
  await expect.poll(headingOnRight).toBe(true);
  await checkMenu("阅读");
  await checkMenu("阅读");
  await turn("prev");
  await checkMenu("我生活的地方");
  await turn("next");
  await checkMenu("阅读");

  await page.getByRole("button", { name: "返回书库" }).click();
  await expect(page.locator(".reading-layer")).toHaveCount(0);
  await page.reload();
  await page.locator('[data-focus-book="1"]').dblclick();
  await tools(page);
  await checkMenu("阅读");
});

for (const [id, format] of [
  ["1", "EPUB"],
  ["4", "PDF"],
  ["5", "Markdown"],
]) {
  test(format + " 底栏显示页码，正文和页边滚轮可往返翻页", async ({ page }) => {
    await page.goto("/#read-" + id);
    await tools(page);
    const label = page.locator(".page-position");
    const wheel = async (
      x: number,
      y: number,
      amount: number,
      text: string,
    ) => {
      await page.mouse.move(x, y);
      await page.mouse.wheel(0, amount);
      await expect(label).toHaveText(text);
    };
    await expect(label).toHaveText("第 1 页");
    await wheel(710, 360, 150, "第 2 页");
    await wheel(10, 85, -150, "第 1 页");
    const display = format === "PDF" ? "阅读显示" : "阅读排版";
    await page.getByRole("button", { name: display, exact: true }).click();
    await page.getByRole("button", { name: "双屏", exact: true }).click();
    await page.getByRole("button", { name: "关闭" + display }).click();
    await expect(label).toHaveText("第 1–2 页");
    await wheel(930, 400, 160, "第 3–4 页");
    await page.getByRole("button", { name: "返回书库" }).click();
    await page.locator('[data-focus-book="' + id + '"]').dblclick();
    await expect(label).toHaveText("第 3–4 页");
  });
}

test("导入 EPUB 跨未读章节跳转后按实际排版累计页码", async ({ page }) => {
  const entries = unzipSync(
    await readFile("tests/fixtures/four-chapters.epub"),
  );
  for (let n = 0; n < 4; n++) {
    const path = "c" + n + ".xhtml";
    entries[path] = strToU8(
      strFromU8(entries[path]).replace(
        /<body>[\s\S]+<\/body>/,
        "<body><h1>Opening</h1>" +
          Array.from(
            { length: n + 1 },
            (_, i) => '<p style="break-before:column">Page ' + (i + 2) + "</p>",
          ).join("") +
          "</body>",
      ),
    );
  }
  const buffer = Buffer.from(zipSync(entries));
  const id = createHash("sha256").update(buffer).digest("hex");
  await page.goto("/");
  await upload(page, {
    name: "pagination.epub",
    mimeType: "application/epub+zip",
    buffer,
  });
  await page.locator('[data-focus-book="' + id + '"]').dblclick();
  await tools(page);
  await page.getByRole("button", { name: "目录", exact: true }).click();
  await page.locator(".contents-list button").last().click();
  const label = page.locator(".page-position");
  await expect(label).toHaveText("第 10 页");
  await page.mouse.move(710, 360);
  await page.mouse.wheel(0, 160);
  await expect(label).toHaveText("第 11 页");
  await page.getByRole("button", { name: "返回书库" }).click();
  await expect(page.locator(".reading-layer")).toHaveCount(0);
  await page.reload();
  await page.locator('[data-focus-book="' + id + '"]').dblclick();
  await expect(label).toHaveText("第 11 页");
});

test("适宽 PDF 用滚轮先读完原页，再翻到下一页", async ({ page }) => {
  await page.goto("/#read-4");
  await tools(page);
  await page.getByRole("button", { name: "阅读显示", exact: true }).click();
  await page.getByLabel("切换 PDF 显示宽度").click();
  await page.getByRole("button", { name: "关闭阅读显示" }).click();
  const renderer = page.locator("foliate-fxl");
  const label = page.locator(".page-position");
  await expect(renderer).toHaveAttribute("overflowing-y", "");
  await page.mouse.move(700, 450);
  await page.mouse.wheel(0, 180);
  await expect
    .poll(() => renderer.evaluate((el) => el.scrollTop))
    .toBeGreaterThan(0);
  await expect(label).toHaveText("第 1 页");
  await page.mouse.wheel(0, 8000);
  await expect
    .poll(() =>
      renderer.evaluate(
        (el) => el.scrollHeight - el.scrollTop - el.clientHeight,
      ),
    )
    .toBeLessThanOrEqual(1);
  await page.mouse.wheel(0, 160);
  await expect(label).toHaveText("第 2 页");
});

test("连续滚轮输入和高速触摸滑动各翻一屏", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#read-1");
  await tools(page);
  const label = page.locator(".page-position");
  await page.mouse.move(190, 330);
  for (let i = 0; i < 14; i++) {
    await page.mouse.wheel(0, 120);
    // Equal ticks within a single burst continue beyond a page animation.
    await page.waitForTimeout(32);
  }
  await expect(label).toHaveText("第 2 页");
  await swipe(page, -200, 0);
  await expect(label).toHaveText("第 3 页");
});

for (const [id, format] of [
  ["1", "EPUB"],
  ["4", "PDF"],
  ["5", "Markdown"],
]) {
  test(format + " 轻滚、短滑、慢滑和斜滑各翻一屏", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/#read-" + id);
    await tools(page);
    const label = page.locator(".page-position");
    await expect(label).toHaveText("第 1 页");
    await page.mouse.move(200, 320);
    await page.mouse.wheel(0, 5);
    await expect(label).toHaveText("第 2 页");
    await page.mouse.wheel(0, -3);
    await expect(label).toHaveText("第 1 页");
    await swipe(page, -20, 0, 55);
    await expect(label).toHaveText("第 2 页");
    await swipe(page, 3, -80);
    await expect(label).toHaveText("第 3 页");
    await swipe(page, 40, 32);
    await expect(label).toHaveText("第 2 页");
    for (let i = 0; i < 3; i++) await swipe(page, -20, 0);
    await expect(label).toHaveText("第 5 页");
  });
}

test("触控板惯性结束后立即再滑、同向短停后轻滚均各翻一屏", async ({ page }) => {
  await page.goto("/#read-1");
  await tools(page);
  const label = page.locator(".page-position");
  await expect(label).toHaveText("第 1 页");
  await page.locator(".book-surface").evaluate(async (el) => {
    function wheel(x: number, y: number, momentum: boolean) {
      const event = new WheelEvent("wheel", {
        deltaX: x,
        deltaY: y,
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperty(event, "momentum", { value: momentum });
      el.dispatchEvent(event);
    }
    wheel(-2, 5, false);
    wheel(-8, 4, false);
    wheel(-3, 2, true);
    wheel(0, 1, true);
    wheel(0, 2, false);
    await new Promise((resolve) => setTimeout(resolve, 135));
    wheel(0, 3, false);
  });
  await expect(label).toHaveText("第 4 页");
});

for (const [file, mime, term] of [
  ["notes.md", "text/markdown", "子曰"],
  ["walden.epub", "application/epub+zip", "pond"],
  ["pdf.pdf", "application/pdf", "the"],
]) {
  test(file + " 搜索分组、折叠及所选原文高亮", async ({ page }, info) => {
    await page.goto("/");
    const buffer = await readFile("public/samples/" + file);
    await upload(page, { name: file, mimeType: mime, buffer });
    const id = createHash("sha256").update(buffer).digest("hex");
    await page.locator('[data-focus-book="' + id + '"]').dblclick();
    await tools(page);
    const open = page.getByRole("button", { name: "书内搜索", exact: true });
    await open.click();
    const field = page.getByLabel("搜索本书");
    await field.fill(term);
    const groups = page.locator("#book-results details");
    const group = groups.nth(1);
    await expect(group).toBeVisible({ timeout: 20000 });
    const cards = group.getByRole("button");
    const count = await cards.count();
    await expect(group.locator("small")).toHaveText(String(count));
    await group.locator("summary").click();
    await expect(cards).toHaveCount(0);
    await group.locator("summary").click();
    const card = cards.nth(Math.min(1, count - 1));
    const expected = await card.locator("mark").innerText();
    await card.click();
    const marked = () =>
      page.locator("foliate-view").evaluate((el) =>
        (el as EpubView).renderer.getContents().flatMap(({ doc }) => {
          const hit = doc?.defaultView?.CSS.highlights.get("found-passage");
          return hit ? Array.from(hit, (r) => r.toString()) : [];
        }),
      );
    await expect.poll(marked).toContain(expected);
    await page
      .locator(".book-surface")
      .screenshot({ path: info.outputPath("active-match.png") });
    await open.click();
    await field.fill("unmatchable-4278");
    await expect(page.locator("#book-results")).toContainText("没有找到");
    await expect.poll(marked).toEqual([]);
    await page.getByRole("button", { name: "返回书库" }).click();
    await expect(page.locator(".reading-layer")).toHaveCount(0);
    await page.locator('[data-focus-book="' + id + '"]').dblclick();
    await expect(page.locator(".page-position")).toHaveText(/第 .+ 页/);
  });
}
