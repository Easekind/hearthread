import { test, expect } from "./chinese-library";
import { basename } from "node:path";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
// Additional acceptance run against a reader's own files, kept outside the repository.
for (const format of ["EPUB", "PDF"] as const) {
  test("personal library " + format, async ({ page }) => {
    const file = process.env["HEARTHREAD_TEST_" + format];
    test.skip(!file, "Set HEARTHREAD_TEST_" + format + " to a local book");
    test.setTimeout(150_000);
    const id = createHash("sha256")
      .update(await fs.readFile(file!))
      .digest("hex");
    await page.goto("/");
    await page.getByLabel("导入书籍", { exact: true }).click();
    await page.locator("#import-files").setInputFiles(file!);
    await page.getByRole("button", { name: "导入 1 本" }).click();
    await page.locator('[data-focus-book="' + id + '"]').dblclick();
    if (format === "PDF") {
      await expect(page.locator(".pdf-sheet canvas")).toBeVisible({
        timeout: 30000,
      });
      await page.locator(".reading-layer").focus();
      await page.keyboard.press("Enter");
      await page.getByRole("button", { name: "目录", exact: true }).click();
      await page.locator(".contents-list button").nth(9).click();
      await expect(page.locator(".pdf-fit")).toContainText("第 10 页", {
        timeout: 30000,
      });
      await page.getByRole("button", { name: "阅读显示", exact: true }).click();
      await page.getByRole("button", { name: "双屏", exact: true }).click();
      await page.getByRole("button", { name: "关闭阅读显示" }).click();
      await expect(page.locator(".pdf-fit")).toContainText("第 9–10 页");
      await page.getByRole("button", { name: "目录", exact: true }).click();
      await expect(
        page.locator(".contents-list [aria-current=location]"),
      ).toContainText("第 10 页");
      await expect(
        page.getByLabel("第 10 页", { exact: true }),
      ).toBeInViewport();
      await page.getByRole("button", { name: "关闭目录" }).click();
      await page.getByRole("button", { name: "向下翻页" }).click();
      await expect(page.locator(".pdf-fit")).toContainText("第 11–12 页");
      await page.getByRole("button", { name: "向上翻页" }).click();
    } else {
      await expect(page.locator("foliate-view iframe").first()).toBeVisible({
        timeout: 30000,
      });
      await page.locator(".reading-layer").focus();
      await page.keyboard.press("Enter");
      await page.getByRole("button", { name: "阅读排版", exact: true }).click();
      await page.getByRole("button", { name: "双屏", exact: true }).click();
      await page.getByRole("button", { name: "关闭阅读排版" }).click();
      await page.getByRole("button", { name: "目录", exact: true }).click();
      const entries = page.locator(".contents-list button");
      await expect(entries.nth(5)).toBeVisible();
      await entries.nth(5).click();
      await expect(page.locator(".chapter-position")).toContainText("第 6 章");
      await page.getByRole("button", { name: "目录", exact: true }).click();
      await expect(entries.nth(5)).toHaveAttribute("aria-current", "location");
      await expect(entries.nth(5)).toBeInViewport();
    }
    await page.getByRole("button", { name: "返回书库" }).click();
    await expect(page.locator(".reading-layer")).toHaveCount(0);
    await page.reload();
    await page.locator('[data-focus-book="' + id + '"]').dblclick();
    if (format === "PDF")
      await expect(page.locator(".pdf-fit")).toContainText("第 9–10 页", {
        timeout: 30000,
      });
    else
      await expect(page.locator(".chapter-position")).toContainText("第 6 章", {
        timeout: 30000,
      });
    await test
      .info()
      .attach("input", { body: basename(file!), contentType: "text/plain" });
  });
}
