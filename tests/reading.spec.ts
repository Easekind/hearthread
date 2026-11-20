import { test, expect, type Page } from "@playwright/test";
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
  await page.getByRole("button", { name: "目录", exact: true }).click();
  await page
    .locator(".contents-list button")
    .filter({ hasText: "湖畔的四季" })
    .click();
  await expect(page.locator(".chapter-position span")).toContainText("第 4 章");
  await page.getByRole("button", { name: "返回书库" }).click();
  await expect(page.locator(".reading-layer")).toHaveCount(0);
  await page.reload();
  await page.locator('[data-focus-book="' + id + '"]').dblclick();
  await expect(page.locator(".chapter-position span")).toContainText("第 4 章");
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
