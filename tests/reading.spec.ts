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
  await expect(page.locator(".markdown-content h2")).toHaveCount(40);
  await tools(page);
  await page.getByRole("button", { name: "书内搜索", exact: true }).click();
  await page.getByLabel("搜索本书").fill("第 26 页");
  await page.locator("#book-results button").click();
  await expect
    .poll(() => page.locator(".reading-layer").evaluate((n) => n.scrollTop))
    .toBeGreaterThan(1000);
  await page.getByRole("button", { name: "返回书库" }).click();
  await expect(page.locator(".reading-layer")).toHaveCount(0);
  await page.reload();
  await page
    .getByRole("button", { name: "选择 读书随笔", exact: true })
    .dblclick();
  await expect
    .poll(() => page.locator(".reading-layer").evaluate((n) => n.scrollTop))
    .toBeGreaterThan(1000);
  await tools(page);
  await page.getByRole("button", { name: "阅读排版", exact: true }).click();
  const paragraph = page.getByText("今天记下第 26 页。", { exact: true });
  await page.getByRole("button", { name: "双屏", exact: true }).click();
  await expect(paragraph).toBeInViewport();
  const spread = page.locator(".text-document");
  const offset = () => spread.evaluate((el) => el.scrollLeft);
  const previous = await offset();
  expect(previous).toBeGreaterThan(0);
  await page.getByRole("button", { name: "关闭阅读排版" }).click();
  await page.getByRole("button", { name: "向上翻页" }).click();
  await expect.poll(offset).toBeLessThan(previous);
  const saved = await offset();
  await page.getByRole("button", { name: "返回书库" }).click();
  await expect(spread).toHaveCount(0);
  await page.reload();
  await page
    .getByRole("button", { name: "选择 读书随笔", exact: true })
    .dblclick();
  await expect(spread).toHaveAttribute("data-layout", "double");
  await expect.poll(offset).toBe(saved);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(spread).toHaveAttribute("data-layout", "single");
  await page.setViewportSize({ width: 820, height: 1180 });
  await expect(spread).toHaveAttribute("data-layout", "double");
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
  await expect(body).toContainText("林间的清晨");
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
    .filter({ hasText: "湖畔的四季" })
    .click();
  await expect(page.locator(".chapter-position")).toContainText("第 4 章");
  const chapter = page.getByRole("slider", { name: "选择章节" });
  await chapter.press("ArrowLeft");
  await expect(chapter).toHaveAttribute("aria-valuenow", "3");

  await page.getByRole("button", { name: "返回书库" }).click();
  await expect(page.locator(".reading-layer")).toHaveCount(0);
  await page.reload();
  await page.locator('[data-focus-book="' + id + '"]').dblclick();
  await expect(page.locator(".chapter-position")).toContainText("第 3 章");
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
  await expect(page.locator(".textLayer")).toContainText("Architecture");
  await tools(page);
  await page.getByRole("button", { name: "阅读显示", exact: true }).click();
  await page.getByRole("button", { name: "跟随系统" }).click();
  await page.emulateMedia({ colorScheme: "dark" });
  const canvas = page.locator(".pdf-sheet canvas");
  await expect(canvas).not.toHaveCSS("filter", "none");
  await expect(page.locator("body")).not.toHaveClass(/theme-dark/);
  await page.reload();
  await expect(canvas).not.toHaveCSS("filter", "none");
  await tools(page);
  await page.getByRole("button", { name: "阅读显示", exact: true }).click();
  await expect(page.getByRole("button", { name: "跟随系统" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "双屏", exact: true }).click();
  await expect(canvas).toHaveCount(2);
  await expect(page.locator(".textLayer").nth(1)).not.toBeEmpty();
  const left = await canvas.first().boundingBox(),
    right = await canvas.last().boundingBox();
  expect(right!.x).toBeGreaterThan(left!.x + left!.width);
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(canvas).toHaveCount(1);
  await expect(page.getByRole("group", { name: "页面布局" })).toHaveCount(0);
  await expect(page.locator(".pdf-fit")).toContainText("第 1 页");
  await page.setViewportSize({ width: 820, height: 1180 });
  await expect(canvas).toHaveCount(2);
  await expect(page.locator(".pdf-fit")).toContainText("第 1–2 页");
  await page.getByRole("button", { name: "单屏", exact: true }).click();
  await expect(canvas).toHaveCount(1);
  await page.getByRole("button", { name: "暖纸" }).click();
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator(".reader")).toHaveAttribute("data-paper", "paper");
  await expect(canvas).toHaveCSS("filter", "none");
  await page.getByRole("button", { name: "关闭阅读显示" }).click();
  await page.getByRole("button", { name: "书内搜索", exact: true }).click();
  await page.getByLabel("搜索本书").fill("Architecture");
  await expect(page.locator("#book-results button").first()).toContainText(
    "第 1 页",
  );
  await page.locator("#book-results button").first().click();
  await page.getByLabel("切换 PDF 显示宽度").click();
  await expect(page.locator(".reader")).toHaveAttribute(
    "data-pdf-wide",
    "true",
  );
});

test("fixed-layout EPUB respects page layout at tablet width", async ({
  page,
}) => {
  const entries = unzipSync(await readFile("public/samples/walden.epub"));
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
  await expect(page.locator(".chapter-position")).toContainText("第 3 章");
  await page.getByRole("button", { name: "返回书库" }).click();
  await expect(page.locator(".reading-layer")).toHaveCount(0);
  await page.reload();
  await page.locator('[data-focus-book="' + id + '"]').dblclick();
  await expect.poll(columns).toBe(2);
  await expect(page.locator(".chapter-position")).toContainText("第 3 章");
});

test("vertical EPUB uses the requested column count on a tall screen", async ({
  page,
}) => {
  const entries = unzipSync(await readFile("public/samples/walden.epub"));
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
  await expect(page.locator(".chapter-position")).toContainText("/ 4");
  await expect.poll(columns).toBe(1);
  await tools(page);
  await page.getByRole("button", { name: "阅读排版", exact: true }).click();
  await page.getByRole("button", { name: "双屏", exact: true }).click();
  await expect.poll(columns).toBe(2);
  await page.getByRole("button", { name: "单屏", exact: true }).click();
  await expect.poll(columns).toBe(1);
});

for (const layout of ["单屏", "双屏"]) {
  test(
    layout + " EPUB 目录、章节滑块和正文使用同一导航条目",
    async ({ page }) => {
      const entries = unzipSync(await readFile("public/samples/walden.epub"));
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
      await expect(page.locator(".chapter-position")).toContainText("/ 4");
      await tools(page);
      if (layout === "双屏") {
        await page
          .getByRole("button", { name: "阅读排版", exact: true })
          .click();
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
      await expect(page.locator(".chapter-position")).toContainText(
        "第 3 章 / 4",
      );
      await page
        .locator(".contents-list button")
        .filter({ hasText: "同页小节" })
        .click();
      await expect(visibleFrame.locator("#near")).toBeInViewport();
      await toc.click();
      await expect(active).toContainText("同页小节");
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
      await page.getByRole("slider", { name: "选择章节" }).press("Home");
      await expect(visibleFrame.locator("h1")).toHaveText("我生活的地方");
      await page.getByRole("button", { name: "返回书库" }).click();
      await book.dblclick();
      await expect(page.locator(".chapter-position")).toContainText(
        "第 1 章 / 4",
      );
      await expect(visibleFrame.locator("h1")).toHaveText("我生活的地方");
      await tools(page);
      await toc.click();
      await expect(active).toContainText("我生活的地方");
    },
  );

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
    await expect(page.locator(".markdown-content h2")).toHaveCount(36);
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
      await expect(
        page.locator(".markdown-content h2").nth(index),
      ).toBeInViewport();
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
    await expect(page.locator(".markdown-content h2").last()).toBeInViewport();
    await toc.click();
    await expect(
      page.locator(".contents-list [aria-current=location] span"),
    ).toHaveText("标题 35");
    await page.getByRole("button", { name: "返回书库" }).click();
    await page
      .getByRole("button", { name: "选择 章节", exact: true })
      .dblclick();
    await expect(page.locator(".markdown-content h2").last()).toBeInViewport();
    await tools(page);
    await toc.click();
    await expect(
      page.locator(".contents-list [aria-current=location] span"),
    ).toHaveText("标题 35");
  });
}
